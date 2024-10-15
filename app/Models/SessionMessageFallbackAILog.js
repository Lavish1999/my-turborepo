'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class SessionMessageFallbackAILog extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  SessionMessageFallbackAILog.init( {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    query_message_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    reply_message_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    execution_response: {
      type: DataTypes.JSON,
      allowNull: true
    },
    source_node: {
      type: DataTypes.JSON,
      allowNull: true
    },
    extra_data: {
      type: DataTypes.JSON,
      allowNull: true
    },
  }, {
    sequelize,
    modelName: 'SessionMessageFallbackAILog',
    tableName: 'session_message_fallbackailogs',
    timestamps: { createdAt: 'created_at'},
    updatedAt: false,
    underscored: true,
  });
  return SessionMessageFallbackAILog;
};