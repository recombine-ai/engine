import typedocSidebar from "./docs/api/typedoc-sidebar.cjs";

module.exports = {
  docsSidebar: [
    // This references our "home" doc with `id: intro`
    'getting-started',


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


