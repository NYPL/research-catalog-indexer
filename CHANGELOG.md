# NB
This changelog was created well after the repo has been in use and only reflects changes from 1/9/25 onward.

# Prerelease
- Combine ligature halves to inverted breve in ingest of bib values 

# v1.0.0
- Update browse term emission rules: send all subjects from ES index and new bib document to Browse Term Indexer. Previous behavior involved filtering out subjects present in both places, and only sending subjects assumed to be added or deleted.
- Update @nypl/browse-term version for updated 690 rules
- Add changelog