# Symbo Suitability Engine demo

Static site for Netlify. The interactive demo is at `/demos/suitabilityengine/`. The root page links to it.

## Deploy from GitHub

1. Create a GitHub repository and upload the contents of this folder, keeping the directory structure. Do not upload the ZIP as one file.
2. In Netlify, open the existing `symbosuitability` project and connect it to the GitHub repository. Select the branch containing these files.
3. The included `netlify.toml` sets the publish directory to the repository root. Leave the build command blank.
4. After the deploy, check `https://symbosuitability.netlify.app/demos/suitabilityengine/`.
5. To use `symbo.si`, add it under Netlify Domain management and point its DNS records to the Netlify project. DNS controls the hostname; this repository supplies the `/demos/suitabilityengine/` path.

The demo is illustrative. It stores decision evidence only in the browser session unless a visitor downloads the JSON record. It does not issue insurance policies.
