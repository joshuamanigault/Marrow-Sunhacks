"""Provision uploads after deploying the new API image, before shipping the frontend.

    uv run python scripts/deploy_uploads.py --api-function marrow-api \
        --distribution-id E10TU2IOR5N8GD --region us-east-1

Uses the active AWS credentials, AWS CLI and the API's resolved ECR image digest.
"""

import argparse
import subprocess
from copy import deepcopy
from pathlib import Path

import boto3

TEMPLATE = Path(__file__).resolve().parents[1] / "deploy" / "uploads.yaml"
CACHING_DISABLED = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
ALL_VIEWER_EXCEPT_HOST = "b689b0a8-53d0-40ab-baf2-68738e2966ac"


def route_uploads(config: dict) -> bool:
    """Use the existing API origin and preserve the distribution's other paths."""
    behaviors = config["CacheBehaviors"]
    items = behaviors["Items"]
    api = next((b for b in items if b["PathPattern"].lstrip("/") == "ai*"), None)
    if not api:
        raise ValueError("Cannot identify the API origin from the existing /ai* route.")
    upload = deepcopy(api)
    upload.update(
        PathPattern="/uploads*",
        AllowedMethods={
            "Quantity": 7,
            "Items": ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "POST", "DELETE"],
            "CachedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]},
        },
        CachePolicyId=CACHING_DISABLED,
        OriginRequestPolicyId=ALL_VIEWER_EXCEPT_HOST,
    )
    for legacy in ("ForwardedValues", "MinTTL", "MaxTTL", "DefaultTTL"):
        upload.pop(legacy, None)
    updated = [
        upload,
        *(b for b in items if b["PathPattern"].lstrip("/") != "uploads*"),
    ]
    if updated == items:
        return False
    behaviors.update(Items=updated, Quantity=len(updated))
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-function", required=True)
    parser.add_argument("--distribution-id", required=True)
    parser.add_argument("--region", required=True)
    args = parser.parse_args()

    session = boto3.Session(region_name=args.region)
    functions = session.client("lambda")
    cdn = session.client("cloudfront")
    function = functions.get_function(FunctionName=args.api_function)
    api = function["Configuration"]
    image_uri = function["Code"]["ResolvedImageUri"]
    account = api["FunctionArn"].split(":")[4]
    role_name = api["Role"].rsplit("/", 1)[1]
    bucket = f"marrow-uploads-{account}-{args.region}-{args.distribution_id.lower()}"
    distribution = cdn.get_distribution(Id=args.distribution_id)
    config = distribution["Distribution"]["DistributionConfig"]
    origins = [
        distribution["Distribution"]["DomainName"],
        *config["Aliases"].get("Items", []),
    ]
    route_changed = route_uploads(config)

    subprocess.run(
        [
            "aws",
            "cloudformation",
            "deploy",
            "--region",
            args.region,
            "--stack-name",
            f"marrow-uploads-{args.distribution_id.lower()}",
            "--template-file",
            str(TEMPLATE),
            "--capabilities",
            "CAPABILITY_IAM",
            "--parameter-overrides",
            f"BucketName={bucket}",
            f"ApiRoleName={role_name}",
            f"ImageUri={image_uri}",
            "AllowedOrigins=" + ",".join(f"https://{name}" for name in origins),
            "--no-fail-on-empty-changeset",
        ],
        check=True,
    )
    environment = api.get("Environment", {})
    if "Error" in environment:
        raise RuntimeError("Could not read existing API environment variables.")
    variables = environment.get("Variables", {})
    if variables.get("UPLOAD_BUCKET") != bucket:
        functions.update_function_configuration(
            FunctionName=args.api_function,
            RevisionId=api["RevisionId"],
            Environment={"Variables": {**variables, "UPLOAD_BUCKET": bucket}},
        )
        functions.get_waiter("function_updated_v2").wait(FunctionName=args.api_function)
    if route_changed:
        cdn.update_distribution(
            Id=args.distribution_id,
            IfMatch=distribution["ETag"],
            DistributionConfig=config,
        )
    cdn.get_waiter("distribution_deployed").wait(Id=args.distribution_id)


if __name__ == "__main__":
    main()
