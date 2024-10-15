"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ChatbotIntegrationsSetting extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.myAssociation=models.ChatbotIntegrationsSetting.hasMany(models.WidgetFormField, { as: 'widget_form_field', foreignKey: "widget_id"});;
      this.myAssociation=models.ChatbotIntegrationsSetting.belongsTo(models.Project, { as: 'project_data', foreignKey: "project_id"});

      this.myAssociation=models.ChatbotIntegrationsSetting.hasMany(models.ChatbotFunction, { as: 'chatbot_functions', foreignKey: "chatbot_id"});
      this.myAssociation=models.ChatbotFunction.belongsTo(models.ChatbotIntegrationsSetting, { as: 'function_chatbot', foreignKey: "chatbot_id"});
      this.myAssociation=models.ChatbotIntegrationsSetting.hasOne(models.ProjectSetting, { as: 'project_setting', sourceKey:"project_id", foreignKey: "project_id"});
      this.myAssociation=models.ChatbotIntegrationsSetting.hasMany(models.ChatbotTrigger, { as: 'chatbot_triggers', foreignKey: "chatbot_id"});
    }
  }
  ChatbotIntegrationsSetting.init(
    {
      name: DataTypes.STRING,
      project_id: DataTypes.INTEGER,
      widget_uid:DataTypes.STRING,
      language:DataTypes.STRING,
      
      logo : DataTypes.STRING,
      position : DataTypes.STRING,
      welcome_message: DataTypes.STRING,
      widget_color: DataTypes.STRING,
      widget_text_color: DataTypes.STRING,
      
      branding_title: DataTypes.STRING,
      branding_color: DataTypes.STRING,
      branding_link: DataTypes.STRING,
      default_questions: DataTypes.STRING,
      message_bg_color: DataTypes.STRING, 
      message_text_color: DataTypes.STRING, 
      reply_text_color: DataTypes.STRING, 
      reply_bg_color: DataTypes.STRING,
      enable_widget_form: DataTypes.BOOLEAN,
      enable_navigation_tracking: DataTypes.BOOLEAN,
      max_execution: DataTypes.INTEGER,
      notify_to: DataTypes.STRING,
      base_prompt: DataTypes.STRING,

      attachment_default_response: DataTypes.JSON,
      unable_to_answer: DataTypes.JSON,
      layout: DataTypes.JSON,
      re_enable_action : DataTypes.JSON,
      response_action: DataTypes.JSON,
      webhook_url: DataTypes.STRING,
      max_execution : DataTypes.STRING,
      custom_widget_domain : DataTypes.STRING,
      flow_enabled: DataTypes.ENUM('0', '1'),
      widget_css : DataTypes.TEXT,
      widget_javascript : DataTypes.TEXT,
      event_webhook_url : DataTypes.STRING,
      is_stream: DataTypes.ENUM('0', '1'),
      voice: DataTypes.JSON,
      throttling_setting: DataTypes.JSON,
      extra_context_keys: DataTypes.STRING,
      queue_replies: DataTypes.JSON,
      search_layout: DataTypes.JSON,
    },
    {
      sequelize,
      modelName: "ChatbotIntegrationsSetting",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return ChatbotIntegrationsSetting;
};