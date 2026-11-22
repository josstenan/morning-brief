# Morning Brief

A daily accounting, finance and tax brief (world and Indonesia), published every morning at 5:00am Melbourne time.

- `index.html`, `static/`: the built dashboard (served by GitHub Pages)
- `briefs/index.json`, `briefs/days/YYYY-MM-DD.json`: the brief data, one file per day
- `app-source/`: the React source, built on [Soft UI Dashboard React](https://github.com/creativetimofficial/soft-ui-dashboard-react) by Creative Tim (MIT License)
- `tools/update_brief.py`: adds a day's brief to the data files and builds the OneDrive archive

The master archive (including the Excel workbook and daily text files) lives in OneDrive under `Morning Brief/`.

To rebuild the site after changing `app-source/`: `cd app-source && npm install --legacy-peer-deps && npm run build`, then copy `build/` to the repository root, keeping `briefs/`.
