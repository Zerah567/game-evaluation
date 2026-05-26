const scoringSystem = {
  scoreRange: {
    min: 1,
    max: 10
  },
  calculation:
    "finalScore = sum(level1.score * level1.weight)，各层级score由其子指标按weight加权计算",
  indicators: [
    {
      id: "product_quality",
      name: "产品品质",
      level: 1,
      weight: 0.35,
      children: [
        {
          id: "product_quality_art",
          name: "产品品质_美术表现",
          level: 2,
          weight: 0.35,
          children: [
            {
              id: "product_quality_art_style",
              name: "产品品质_美术表现_美术风格与视觉效果",
              level: 3,
              weight: 0.5
            },
            {
              id: "product_quality_art_ui",
              name: "产品品质_美术表现_UI/UX设计",
              level: 3,
              weight: 0.3
            },
            {
              id: "product_quality_art_tech",
              name: "产品品质_美术表现_技术力表现",
              level: 3,
              weight: 0.2
            }
          ]
        },
        {
          id: "product_quality_audio",
          name: "产品品质_音乐音效",
          level: 2,
          weight: 0.15,
          children: [
            {
              id: "product_quality_audio_music",
              name: "产品品质_音乐音效_配乐与音效设计",
              level: 3,
              weight: 0.6
            },
            {
              id: "product_quality_audio_atmosphere",
              name: "产品品质_音乐音效_语音与氛围营造",
              level: 3,
              weight: 0.4
            }
          ]
        },
        {
          id: "product_quality_controls",
          name: "产品品质_操作交互",
          level: 2,
          weight: 0.2,
          children: [
            {
              id: "product_quality_controls_feel",
              name: "产品品质_操作交互_操作手感与流畅度",
              level: 3,
              weight: 0.5
            },
            {
              id: "product_quality_controls_feedback",
              name: "产品品质_操作交互_交互反馈与响应",
              level: 3,
              weight: 0.3
            },
            {
              id: "product_quality_controls_platform",
              name: "产品品质_操作交互_多平台适配",
              level: 3,
              weight: 0.2
            }
          ]
        },
        {
          id: "product_quality_story",
          name: "产品品质_剧情题材",
          level: 2,
          weight: 0.3,
          children: [
            {
              id: "product_quality_story_depth",
              name: "产品品质_剧情题材_剧情深度与叙事",
              level: 3,
              weight: 0.5
            },
            {
              id: "product_quality_story_world",
              name: "产品品质_剧情题材_世界观构建",
              level: 3,
              weight: 0.3
            },
            {
              id: "product_quality_story_character",
              name: "产品品质_剧情题材_角色塑造",
              level: 3,
              weight: 0.2
            }
          ]
        }
      ]
    },
    {
      id: "gameplay_design",
      name: "玩法设计",
      level: 1,
      weight: 0.35,
      children: [
        {
          id: "gameplay_design_innovation",
          name: "玩法设计_玩法创新",
          level: 2,
          weight: 0.25,
          children: [
            {
              id: "gameplay_design_innovation_core",
              name: "玩法设计_玩法创新_核心玩法创新度",
              level: 3,
              weight: 0.5
            },
            {
              id: "gameplay_design_innovation_fusion",
              name: "玩法设计_玩法创新_机制融合新颖度",
              level: 3,
              weight: 0.3
            },
            {
              id: "gameplay_design_innovation_differentiation",
              name: "玩法设计_玩法创新_与同类竞品差异度",
              level: 3,
              weight: 0.2
            }
          ]
        },
        {
          id: "gameplay_design_depth",
          name: "玩法设计_玩法深度",
          level: 2,
          weight: 0.3,
          children: [
            {
              id: "gameplay_design_depth_content",
              name: "玩法设计_玩法深度_内容丰富度",
              level: 3,
              weight: 0.4
            },
            {
              id: "gameplay_design_depth_level",
              name: "玩法设计_玩法深度_关卡与地图设计",
              level: 3,
              weight: 0.3
            },
            {
              id: "gameplay_design_depth_strategy",
              name: "玩法设计_玩法深度_策略与决策空间",
              level: 3,
              weight: 0.3
            }
          ]
        },
        {
          id: "gameplay_design_playability",
          name: "玩法设计_可玩性",
          level: 2,
          weight: 0.25,
          children: [
            {
              id: "gameplay_design_playability_fun",
              name: "玩法设计_可玩性_玩法趣味性",
              level: 3,
              weight: 0.5
            },
            {
              id: "gameplay_design_playability_motivation",
              name: "玩法设计_可玩性_目标驱动力",
              level: 3,
              weight: 0.3
            },
            {
              id: "gameplay_design_playability_replay",
              name: "玩法设计_可玩性_重复可玩性",
              level: 3,
              weight: 0.2
            }
          ]
        },
        {
          id: "gameplay_design_social",
          name: "玩法设计_社交性",
          level: 2,
          weight: 0.1,
          children: [
            {
              id: "gameplay_design_social_multiplayer",
              name: "玩法设计_社交性_多人社交功能",
              level: 3,
              weight: 0.5
            },
            {
              id: "gameplay_design_social_community",
              name: "玩法设计_社交性_社区生态",
              level: 3,
              weight: 0.5
            }
          ]
        },
        {
          id: "gameplay_design_onboarding",
          name: "玩法设计_新手引导",
          level: 2,
          weight: 0.1,
          children: [
            {
              id: "gameplay_design_onboarding_clarity",
              name: "玩法设计_新手引导_新手引导清晰度",
              level: 3,
              weight: 0.5
            },
            {
              id: "gameplay_design_onboarding_threshold",
              name: "玩法设计_新手引导_上手门槛",
              level: 3,
              weight: 0.5
            }
          ]
        }
      ]
    },
    {
      id: "market_positioning",
      name: "市场定位",
      level: 1,
      weight: 0.2,
      children: [
        {
          id: "market_positioning_category",
          name: "市场定位_品类匹配度",
          level: 2,
          weight: 0.3,
          children: [
            {
              id: "market_positioning_category_size",
              name: "市场定位_品类匹配度_品类市场规模",
              level: 3,
              weight: 0.5
            },
            {
              id: "market_positioning_category_trend",
              name: "市场定位_品类匹配度_品类增长趋势",
              level: 3,
              weight: 0.5
            }
          ]
        },
        {
          id: "market_positioning_audience",
          name: "市场定位_目标受众",
          level: 2,
          weight: 0.2,
          children: [
            {
              id: "market_positioning_audience_clarity",
              name: "市场定位_目标受众_受众定位清晰度",
              level: 3,
              weight: 0.5
            },
            {
              id: "market_positioning_audience_scale",
              name: "市场定位_目标受众_受众规模与潜力",
              level: 3,
              weight: 0.5
            }
          ]
        },
        {
          id: "market_positioning_competition",
          name: "市场定位_竞品差距",
          level: 2,
          weight: 0.25,
          children: [
            {
              id: "market_positioning_competition_gap",
              name: "市场定位_竞品差距_与头部竞品差距",
              level: 3,
              weight: 0.6
            },
            {
              id: "market_positioning_competition_differentiation",
              name: "市场定位_竞品差距_差异化优势",
              level: 3,
              weight: 0.4
            }
          ]
        },
        {
          id: "market_positioning_ip",
          name: "市场定位_IP品牌价值",
          level: 2,
          weight: 0.15,
          children: [
            {
              id: "market_positioning_ip_influence",
              name: "市场定位_IP品牌价值_IP影响力",
              level: 3,
              weight: 0.5
            },
            {
              id: "market_positioning_ip_potential",
              name: "市场定位_IP品牌价值_品牌延伸潜力",
              level: 3,
              weight: 0.5
            }
          ]
        },
        {
          id: "market_positioning_topic",
          name: "市场定位_话题性",
          level: 2,
          weight: 0.1,
          children: [
            {
              id: "market_positioning_topic_heat",
              name: "市场定位_话题性_话题度与讨论热度",
              level: 3,
              weight: 0.5
            },
            {
              id: "market_positioning_topic_streaming",
              name: "市场定位_话题性_直播与视频传播潜力",
              level: 3,
              weight: 0.5
            }
          ]
        }
      ]
    },
    {
      id: "commercial_potential",
      name: "商业潜力",
      level: 1,
      weight: 0.1,
      children: [
        {
          id: "commercial_potential_payment_model",
          name: "商业潜力_付费模式",
          level: 2,
          weight: 0.3,
          children: [
            {
              id: "commercial_potential_payment_model_reasonableness",
              name: "商业潜力_付费模式_付费模式合理性",
              level: 3,
              weight: 0.5
            },
            {
              id: "commercial_potential_payment_model_clarity",
              name: "商业潜力_付费模式_付费引导清晰度",
              level: 3,
              weight: 0.5
            }
          ]
        },
        {
          id: "commercial_potential_payment_depth",
          name: "商业潜力_付费深度",
          level: 2,
          weight: 0.25,
          children: [
            {
              id: "commercial_potential_payment_depth_design",
              name: "商业潜力_付费深度_付费点设计",
              level: 3,
              weight: 0.5
            },
            {
              id: "commercial_potential_payment_depth_sustainability",
              name: "商业潜力_付费深度_付费深度与持续性",
              level: 3,
              weight: 0.5
            }
          ]
        },
        {
          id: "commercial_potential_acquisition",
          name: "商业潜力_获客效率",
          level: 2,
          weight: 0.2,
          children: [
            {
              id: "commercial_potential_acquisition_cost",
              name: "商业潜力_获客效率_买量获客成本",
              level: 3,
              weight: 0.5
            },
            {
              id: "commercial_potential_acquisition_organic",
              name: "商业潜力_获客效率_自然获客能力",
              level: 3,
              weight: 0.5
            }
          ]
        },
        {
          id: "commercial_potential_long_term",
          name: "商业潜力_长线运营",
          level: 2,
          weight: 0.25,
          children: [
            {
              id: "commercial_potential_long_term_planning",
              name: "商业潜力_长线运营_长线运营规划",
              level: 3,
              weight: 0.5
            },
            {
              id: "commercial_potential_long_term_updates",
              name: "商业潜力_长线运营_版本更新潜力",
              level: 3,
              weight: 0.5
            }
          ]
        }
      ]
    }
  ]
};

module.exports = scoringSystem;
