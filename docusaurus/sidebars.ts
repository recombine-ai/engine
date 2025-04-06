import typedocSidebar from "./docs/api/typedoc-sidebar.cjs";

module.exports = {
  docsSidebar: [
    // This references our "home" doc with `id: intro`
    'intro',

    // A single "Getting Started" category (or you can just link the page)
    {
      type: 'doc',
      label: 'Getting Started',
      id: 'getting-started',
    },

    // The "API Reference" section, which is all the .md files in /docs/api
    {
      type: 'category',
      label: 'API Reference',
      items: [{type: 'doc',
        label: 'API Overview',
        id: 'api/index',}, ...typedocSidebar]
    },
  ],
};


