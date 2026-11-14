# Fossil CT Lab dataset research — 2026-11-13

Recommendation: use Eosphorosuchus lacrimosa (YPM VP 41198) as the flagship candidate; use PIN 5087/37 as a smaller pipeline-validation fallback. This recommendation is provisional until binary downloads and spatial alignment are tested.

## Candidate records

- Eosphorosuchus: https://doi.org/10.5061/dryad.q83bk3jvv . Appendix1.zip contains CT TIFFs and scan metadata (4.63 GB); Appendix2.zip contains 21 named skull-element STLs (210.03 MB compressed). Browser archive previews confirmed TIFF and STL entries. One STL is about 394 MB uncompressed. Separate meshes enable a proposed anatomy-isolation workflow; browser optimization is necessary.
- PIN 5087/37: https://doi.org/10.5061/dryad.t1g1jwt2d . CT ZIP 88.71 MB; exterior STL 32.16 MB. Browser preview shows sequential JPG slices; repository documentation lists VGI scan settings. Several internal anatomical reconstructions are distributed inside 3D PDFs, so separate internal meshes should not be assumed available.
- Ancient bird MPM-334-1: https://doi.org/10.5061/dryad.79cnp5hzn . CT ZIP 4.44 GB; separate braincase, endocast and inner-ear PLY files. Best alternative for a small number of meaningful anatomical layers.
- Hadrosaur limb pathology: https://doi.org/10.5061/dryad.b84nh . Radius JPG stack 472.43 MB; radius STL 23.87 MB. Candidate for a dinosaur-focused case; no ready voxel-level pathology mask confirmed.
- QMF60282: https://doi.org/10.5061/dryad.mw6m9064n . Archive 7.85 GB; sparse annotated training slices. Publication says trained models/code are available on request. Poor first choice for a short build.

## Repositories and education

- NoCTURN provides discovery and teaching resources: https://nocturnetwork.org/resources/e/ . It links DigiMorph, SlicerMorph and tutorials rather than supplying a single standardized fossil dataset.
- Education kits and Dinosaur Dentist: https://www.graysvertebrateanatomy.com/work/educational-resources/ . Useful inspiration; mesh availability does not establish CT-volume availability.
- MorphoSource download requirements: https://www.floridamuseum.ufl.edu/digital-lab/resources/access-ct-scans-online/ . Account required; individual media can require approval.
- Dryad reuse guidance: https://datadryad.org/help/guides/reuse . The three cached dataset API records explicitly report CC0-1.0. Retain specimen identifiers and citations in the app.

## Verification performed and remaining

Read relevant Lobe input validation, meshing, coordinate transforms, layer loading and seeded-case contracts. Retrieved three public dataset metadata records and their file manifests; these include exact sizes and published SHA-256 checksums.

Website file downloads returned HTTP 403; public API file-download routes returned HTTP 401; browser downloads timed out. This is a limitation of this verification, not evidence that every human visitor needs an account. No scan or mesh binary was successfully downloaded, rendered, converted or tested in Lobe. Archive contents were inspected through Dryad's browser preview.

Before implementation, obtain the flagship CT/mesh archives, verify checksums, inspect voxel spacing/orientation, and compare mesh coordinates with the original CT. The fossil's reconstructed presentation may differ from its scanned arrangement; do not assume registration. Then downsample the CT, simplify meshes, and measure load time and memory in the browser.

## Proposed integration

Prepare a single curated specimen offline. Convert CT slices to NIfTI while preserving physical spacing; export optimized, named GLB nodes. Supply source metadata and educational annotations. Existing meshes are not voxel-label masks: create overlays only after registration is verified. Replace four-MRI validation and brain/tumor semantics, generalize camera scale and coordinate naming, and bypass brain inference. Preserve original volumes and geometries for reference. Do not apply brain-specific hole filling or size filtering without checking fossil features. True 3D cutaway rendering remains additional work; Lobe's current slice panels are 2D volume cross-sections.

All research outputs are under the existing ignored jobs/ directory. No application files were modified.
