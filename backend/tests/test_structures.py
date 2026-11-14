import re

from marrow.structures import (
    STRUCTURE_CATALOG,
    color_for_structure_id,
    structure_by_id,
)

_HEX = re.compile(r"^#[0-9a-f]{6}$")


def test_catalog_keeps_left_right_distinct() -> None:
    left = structure_by_id("maxilla_l")
    right = structure_by_id("maxilla_r")
    assert left is not None and right is not None
    assert left.name == right.name == "Maxilla"
    assert left.side == "left"
    assert right.side == "right"
    assert left.source_filename != right.source_filename


def test_structure_colors_are_stable_hex_and_distinct_for_sides() -> None:
    left = color_for_structure_id("maxilla_l")
    right = color_for_structure_id("maxilla_r")
    assert _HEX.fullmatch(left)
    assert _HEX.fullmatch(right)
    assert left != right
    assert color_for_structure_id("maxilla_l") == left
    colors = {entry.color for entry in STRUCTURE_CATALOG.values()}
    assert all(_HEX.fullmatch(c) for c in colors)
    assert len(colors) == len(STRUCTURE_CATALOG)


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
