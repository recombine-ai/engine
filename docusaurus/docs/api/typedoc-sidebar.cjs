// @ts-check
/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const typedocSidebar = { items: [
  {
    "type": "category",
    "label": "Interfaces",
    "items": [
      {
        "type": "doc",
        "id": "api/interfaces/Action",
        "label": "Action"
      },
      {
        "type": "doc",
        "id": "api/interfaces/Logger",
        "label": "Logger"
      },
      {
        "type": "doc",
        "id": "api/interfaces/Message",
        "label": "Message"
      },
      {
        "type": "doc",
        "id": "api/interfaces/Schedule",
        "label": "Schedule"
      },
      {
        "type": "doc",
        "id": "api/interfaces/Scheduler",
        "label": "Scheduler"
      },
      {
        "type": "doc",
        "id": "api/interfaces/TesAgentFactoryProps",
        "label": "TesAgentFactoryProps"
      },
      {
        "type": "doc",
        "id": "api/interfaces/TestAgent",
        "label": "TestAgent"
      }
    ]
  },
  {
    "type": "category",
    "label": "Functions",
    "items": [
      {
        "type": "doc",
        "id": "api/functions/createAIEngine",
        "label": "createAIEngine"
      },
      {
        "type": "doc",
        "id": "api/functions/createContext",
        "label": "createContext"
      },
      {
        "type": "doc",
        "id": "api/functions/createMock",
        "label": "createMock"
      },
      {
        "type": "doc",
        "id": "api/functions/createTestAgentFactory",
        "label": "createTestAgentFactory"
      },
      {
        "type": "doc",
        "id": "api/functions/delayFactory",
        "label": "delayFactory"
      },
      {
        "type": "doc",
        "id": "api/functions/makeAction",
        "label": "makeAction"
      },
      {
        "type": "doc",
        "id": "api/functions/makeActionWrapper",
        "label": "makeActionWrapper"
      }
    ]
  },
  {
    "type": "category",
    "label": "Type Aliases",
    "items": [
      {
        "type": "doc",
        "id": "api/type-aliases/AiEngine",
        "label": "AiEngine"
      },
      {
        "type": "doc",
        "id": "api/type-aliases/Context",
        "label": "Context"
      },
      {
        "type": "doc",
        "id": "api/type-aliases/SendAction",
        "label": "SendAction"
      },
      {
        "type": "doc",
        "id": "api/type-aliases/TestAgentFactory",
        "label": "TestAgentFactory"
      }
    ]
  }
]};
module.exports = typedocSidebar.items;