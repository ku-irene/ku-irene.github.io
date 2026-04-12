# Mathematics and Computers in Simulation LaTeX setup

This folder is prepared for submissions to *Mathematics and Computers in Simulation* using Elsevier's official `elsarticle` template and the numbered reference style `elsarticle-num-names.bst`.

Files:

- `main.tex`: manuscript skeleton ready to edit
- `references.bib`: BibTeX database
- `highlights.txt`: editable highlights text
- `elsarticle.cls`: Elsevier document class
- `elsarticle-num-names.bst`: bibliography style required by the guide
- `elsarticle-template-num-names.tex`: untouched official sample template

Recommended workflow:

1. Edit `main.tex` with title, authors, abstract, keywords, MSC codes, and sections.
2. Update `highlights.txt` and mirror the same points in the `highlights` environment if needed.
3. Add bibliography entries to `references.bib`.
4. Keep figure files alongside the submission package when you prepare the final upload. The author guide asks for submission files without nested folders.
5. Compile with `latexmk -pdf main.tex`.

Submission checklist aligned to the author guide:

- Use clear English and include all author affiliations and a corresponding author email.
- Provide an abstract, keywords, and MSC codes if applicable.
- Use numbered references and make sure every citation appears in the bibliography.
- Include declaration of competing interest, CRediT statement, and data availability statement.
- Prepare editable source files for figures/tables and keep captions in the manuscript.
- Check whether highlights and any supplementary files requested by the submission system are included at upload time.
