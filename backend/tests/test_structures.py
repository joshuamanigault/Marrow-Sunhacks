from marrow.structures import STRUCTURE_CATALOG, structure_by_id


def test_catalog_keeps_left_right_distinct() -> None:
    left = structure_by_id("maxilla_l")
    right = structure_by_id("maxilla_r")
    assert left is not None and right is not None
    assert left.name == right.name == "Maxilla"
    assert left.side == "left"
    assert right.side == "right"
    assert left.source_filename != right.source_filename


def test_catalog_covers_published_appendix2_list() -> None:
    names = {entry.source_filename for entry in STRUCTURE_CATALOG.values()}
    expected = {
        "angularL.stl",
        "ectopterygoidL.stl",
        "ectopterygoidR.stl",
        "frontalL.stl",
        "frontalR.stl",
        "jugalR.stl",
        "lacrimalR.stl",
        "maxillaL.stl",
        "maxillaR.stl",
        "nasalR.stl",
        "palatineR.stl",
        "palpebralR.stl",
        "postorbitalR.stl",
        "prefrontalR.stl",
        "premaxillaR.stl",
        "pterygoidL.stl",
        "pterygoidR.stl",
        "quadrateL.stl",
        "quadrateR.stl",
        "surangularL.stl",
        "vomers.stl",
    }
    assert names == expected
