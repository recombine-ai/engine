// @ts-check
/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const typedocSidebar = { items: [
  {
    "type": "category",
    "label": "Namespaces",
    "items": [
      {
        "type": "category",
        "label": "AIEngine",
        "items": [
          {
            "type": "category",
            "label": "Functions",
            "items": [
              {
                "type": "doc",
                "id": "api/@recombine-ai/namespaces/AIEngine/functions/createAIEngine",
                "label": "createAIEngine"
              }
            ]
          },
          {
            "type": "category",
            "label": "Interfaces",
            "items": [
              {
                "type": "doc",
                "id": "api/@recombine-ai/namespaces/AIEngine/interfaces/AIEngine",
                "label": "AIEngine"
              },
              {
                "type": "doc",
                "id": "api/@recombine-ai/namespaces/AIEngine/interfaces/Conversation",
                "label": "Conversation"
              },
              {
                "type": "doc",
                "id": "api/@recombine-ai/namespaces/AIEngine/interfaces/EngineConfig",
                "label": "EngineConfig"
              },
              {
                "type": "doc",
                "id": "api/@recombine-ai/namespaces/AIEngine/interfaces/File",
                "label": "File"
              },
              {
                "type": "doc",
                "id": "api/@recombine-ai/namespaces/AIEngine/interfaces/LLMStep",
                "label": "LLMStep"
              },
              {
                "type": "doc",
                "id": "api/@recombine-ai/namespaces/AIEngine/interfaces/Message",
                "label": "Message"
              },
              {
                "type": "doc",
                "id": "api/@recombine-ai/namespaces/AIEngine/interfaces/ProgrammaticStep",
                "label": "ProgrammaticStep"
              },
              {
                "type": "doc",
                "id": "api/@recombine-ai/namespaces/AIEngine/interfaces/Workflow",
                "label": "Workflow"
              }
            ]
          },
          {
            "type": "category",
            "label": "Type Aliases",
            "items": [
              {
                "type": "doc",
                "id": "api/@recombine-ai/namespaces/AIEngine/type-aliases/BasicModel",
                "label": "BasicModel"
              }
            ]
          }
        ],
        "link": {
          "type": "doc",
          "id": "api/@recombine-ai/namespaces/AIEngine/index"
        }
      },
      {
        "type": "category",
        "label": "Bosun",
        "items": [
          {
            "type": "category",
            "label": "Functions",
            "items": [
              {
                "type": "doc",
                "id": "api/@recombine-ai/namespaces/Bosun/functions/createTestAgentFactory",
                "label": "createTestAgentFactory"
              }
            ]
          },
          {
            "type": "category",
            "label": "Interfaces",
            "items": [
              {
                "type": "doc",
                "id": "api/@recombine-ai/namespaces/Bosun/interfaces/TesAgentFactoryProps",
                "label": "TesAgentFactoryProps"
              },
              {
                "type": "doc",
                "id": "api/@recombine-ai/namespaces/Bosun/interfaces/TestAgent",
                "label": "TestAgent"
              }
            ]
          },
          {
            "type": "category",
            "label": "Type Aliases",
            "items": [
              {
                "type": "doc",
                "id": "api/@recombine-ai/namespaces/Bosun/type-aliases/TestAgentFactory",
                "label": "TestAgentFactory"
              }
            ]
          }
        ],
        "link": {
          "type": "doc",
          "id": "api/@recombine-ai/namespaces/Bosun/index"
        }
      },
      {
        "type": "category",
        "label": "Scheduler",
        "items": [
          {
            "type": "category",
            "label": "Interfaces",
            "items": [
              {
                "type": "doc",
                "id": "api/@recombine-ai/namespaces/Scheduler/interfaces/Scheduler",
                "label": "Scheduler"
              }
            ]
          },
          {
            "type": "category",
            "label": "Type Aliases",
            "items": [
              {
                "type": "doc",
                "id": "api/@recombine-ai/namespaces/Scheduler/type-aliases/ScheduleAction",
                "label": "ScheduleAction"
              }
            ]
          }
        ],
        "link": {
          "type": "doc",
          "id": "api/@recombine-ai/namespaces/Scheduler/index"
        }
      }
    ]
  },
  {
    "type": "category",
    "label": "Functions",
    "items": [
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
        "id": "api/interfaces/Schedule",
        "label": "Schedule"
      }
    ]
  },
  {
    "type": "category",
    "label": "Type Aliases",
    "items": [
      {
        "type": "doc",
        "id": "api/type-aliases/Context",
        "label": "Context"
      },
      {
        "type": "doc",
        "id": "api/type-aliases/SendAction",
        "label": "SendAction"
      }
    ]
  }
]};
module.exports = typedocSidebar.items;