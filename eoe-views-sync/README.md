# Eyes on Eyecare: views sync

Every 5 minutes `.github/workflows/eoe-sync-views.yml` runs `sync-views.mjs`:
it reads each live article's view counter from Abacus (`abacus.jasoncameron.dev`, namespace `eyesoneyecare`,
key `<collection-slug>-<item-slug>`) and writes "N views" into the Webflow CMS field `views`
(staged + live) for News, Market Research, Eyecare Executive and Case Studies.

The counting itself happens on the site (Webflow site script `ArticleViewsCounter`): +1 on every post open,
cards read their counter. The CMS value makes the number appear in the HTML on the first load.

Setup: repo secret `WEBFLOW_TOKEN` = Webflow site API token with CMS read and write.
Manual run: Actions > "EoE - sync article views to Webflow CMS" > Run workflow.
