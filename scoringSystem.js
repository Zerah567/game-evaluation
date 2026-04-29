const scoringSystem = {
  scoreRange: {
    min: 1,
    max: 10
  },
  calculation:
    "finalScore = sum(level1.score * level1.weight)，各层级score由其子指标按weight加权计算",
  indicators: [
    {
      id: "game_positioning",
      name: "游戏定位",
      level: 1,
      weight: 0.4,
      children: [
        {
          id: "game_positioning_innovation",
          name: "游戏定位_创新度",
          level: 2,
          weight: 0.1,
          children: [
            {
              id: "game_positioning_innovation_art",
              name: "游戏定位_创新度_美术创新",
              level: 3,
              weight: 0.3
            },
            {
              id: "game_positioning_innovation_business_model",
              name: "游戏定位_创新度_商业模式创新",
              level: 3,
              weight: 0.2
            },
            {
              id: "game_positioning_innovation_gameplay",
              name: "游戏定位_创新度_玩法创新",
              level: 3,
              weight: 0.3
            },
            {
              id: "game_positioning_innovation_narrative_ip",
              name: "游戏定位_创新度_叙事IP创新",
              level: 3,
              weight: 0.2
            }
          ]
        },
        {
          id: "game_positioning_category",
          name: "游戏定位_品类情况",
          level: 2,
          weight: 0.3,
          children: [
            {
              id: "game_positioning_category_market_size",
              name: "游戏定位_品类情况_同类市场规模",
              level: 3,
              weight: 0.5
            },
            {
              id: "game_positioning_category_competitor_gap",
              name: "游戏定位_品类情况_与头部竞品差距",
              level: 3,
              weight: 0.5
            }
          ]
        },
        {
          id: "game_positioning_user_growth_potential",
          name: "游戏定位_用户增长潜力",
          level: 2,
          weight: 0.6,
          children: [
            {
              id: "game_positioning_user_growth_potential_paid_acquisition",
              name: "游戏定位_用户增长潜力_买量评估",
              level: 3,
              weight: 0.1
            },
            {
              id: "game_positioning_user_growth_potential_topic",
              name: "游戏定位_用户增长潜力_话题性",
              level: 3,
              weight: 0.3
            },
            {
              id: "game_positioning_user_growth_potential_ip_bonus",
              name: "游戏定位_用户增长潜力_IP加成",
              level: 3,
              weight: 0.2
            },
            {
              id: "game_positioning_user_growth_potential_user_scale",
              name: "游戏定位_用户增长潜力_用户规模",
              level: 3,
              weight: 0.1
            },
            {
              id: "game_positioning_user_growth_potential_live_streaming_fit",
              name: "游戏定位_用户增长潜力_直播契合度",
              level: 3,
              weight: 0.3
            }
          ]
        }
      ]
    },
    {
      id: "gameplay",
      name: "游戏性",
      level: 1,
      weight: 0.6,
      children: [
        {
          id: "gameplay_presentation",
          name: "游戏性_表现力",
          level: 2,
          weight: 0.2,
          children: [
            {
              id: "gameplay_presentation_story_theme",
              name: "游戏性_表现力_剧情题材表现",
              level: 3,
              weight: 0.3
            },
            {
              id: "gameplay_presentation_art",
              name: "游戏性_表现力_美术表现",
              level: 3,
              weight: 0.5
            },
            {
              id: "gameplay_presentation_music",
              name: "游戏性_表现力_音乐表现",
              level: 3,
              weight: 0.2
            }
          ]
        },
        {
          id: "gameplay_playability",
          name: "游戏性_可玩性",
          level: 2,
          weight: 0.25,
          children: [
            {
              id: "gameplay_playability_operation_interaction",
              name: "游戏性_可玩性_操作交互",
              level: 3,
              weight: 0.2
            },
            {
              id: "gameplay_playability_gameplay_design",
              name: "游戏性_可玩性_玩法设计",
              level: 3,
              weight: 0.5
            },
            {
              id: "gameplay_playability_motivation",
              name: "游戏性_可玩性_游戏驱动力",
              level: 3,
              weight: 0.3
            }
          ]
        },
        {
          id: "gameplay_depth",
          name: "游戏性_玩法深度",
          level: 2,
          weight: 0.25,
          children: [
            {
              id: "gameplay_depth_content_richness",
              name: "游戏性_玩法深度_内容丰富度",
              level: 3,
              weight: 0.45
            },
            {
              id: "gameplay_depth_level_design",
              name: "游戏性_玩法深度_关卡设计",
              level: 3,
              weight: 0.4
            },
            {
              id: "gameplay_depth_social",
              name: "游戏性_玩法深度_玩家社交性",
              level: 3,
              weight: 0.15
            }
          ]
        },
        {
          id: "gameplay_retention_development",
          name: "游戏性_留存养成",
          level: 2,
          weight: 0.15,
          children: [
            {
              id: "gameplay_retention_development_tutorial_clarity",
              name: "游戏性_留存养成_新手引导清晰度",
              level: 3,
              weight: 0.3
            },
            {
              id: "gameplay_retention_development_growth_goal_clarity",
              name: "游戏性_留存养成_养成目标清晰度",
              level: 3,
              weight: 0.3
            },
            {
              id: "gameplay_retention_development_long_term_plan_clarity",
              name: "游戏性_留存养成_长线体验规划清晰度",
              level: 3,
              weight: 0.4
            }
          ]
        },
        {
          id: "gameplay_revenue_ability",
          name: "游戏性_营收能力",
          level: 2,
          weight: 0.15,
          children: [
            {
              id: "gameplay_revenue_ability_payment_guidance_clarity",
              name: "游戏性_营收能力_付费引导清晰度",
              level: 3,
              weight: 0.5
            },
            {
              id: "gameplay_revenue_ability_payment_depth",
              name: "游戏性_营收能力_付费深度",
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