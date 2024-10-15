"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ChatbotJob extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      // this.myAssociation=models.ChatbotJob.hasMany(models.ChatbotJobParameter, { as: 'parameters', foreignKey: "job_id"});
    }
  }
  ChatbotJob.init(
    {
      project_id : DataTypes.INTEGER,
      type: DataTypes.ENUM("crisp_training","intercom_training","discord_training","slack_training","self_conversation_training"),
      job_name: DataTypes.STRING,
      job_data : DataTypes.JSON,
      parameters : DataTypes.JSON,
      status: DataTypes.ENUM('pending','running','paused','moving_to_next_queue','finished','error'),
      status_info: DataTypes.TEXT,
      instruction: DataTypes.TEXT
    },
    {
      sequelize,
      modelName: "ChatbotJob",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true
    }
  );
  return ChatbotJob;
};