'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class SessionMessage extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            models.Session.hasMany(models.SessionMessage    , {foreignKey : "session_id",as:"message"})
            models.SessionMessage.hasMany(models.SessionMessageFallbackAILog , {foreignKey : "reply_message_id",as:"AILog"})
            models.SessionMessage.belongsTo(models.User     , {foreignKey : "sender_id",as:"operator"})
            models.SessionMessage.belongsTo(models.Session     , {foreignKey : "session_id",as:"session_data"})
            models.SessionMessagesMeta.belongsTo(models.SessionMessage     , {foreignKey : "message_id",as:"meta_message_message_data"})
            models.SessionMessage.hasOne(models.SessionMessagesMeta     , {foreignKey : "message_id",as:"session_messages_meta"})
        }
    };
    SessionMessage.init({
        session_id: DataTypes.INTEGER,
        send_by: DataTypes.ENUM('user','assistant','operator'),
        rate:DataTypes.ENUM('0','1'),
        message: {
            type: DataTypes.TEXT,
            set(value) {
              // Stringify the JSON data when setting it
              if (value != "" && value != null && value != undefined) {
                this.setDataValue('message', htmlEscape(value));
              }
            },
        },
        type:DataTypes.INTEGER,
        seen: DataTypes.ENUM('0','1','2'), // 0 -> not seen , 1 -> seen in chat , 2 -> seen in email
        sender_id : DataTypes.INTEGER,
        content_type : DataTypes.STRING,
        choices : DataTypes.JSON,
        targets : DataTypes.JSON,
        url : DataTypes.STRING,
        delivered: DataTypes.ENUM('0','1','2'), // 0 -> not delivered , 1 -> delivered in chat , 2 -> delivered in email
        provider_message_id : DataTypes.STRING,
        streaming: DataTypes.BOOLEAN,
        response_source: DataTypes.ENUM('automated_response', 'studio_response', 'knowledgebase_response')
    }, {
        sequelize,
        modelName: 'SessionMessage',
        timestamps: { createdAt: 'created_at'},
        deletedAt : "deleted_at",
        paranoid : true,
        updatedAt: false,
        underscored: true,
    });
    return SessionMessage;
};

const htmlEscape = (text) => {
    return text.replace(/&/g, '&amp;').
      replace(/</g, '&lt;').  // it's not neccessary to escape >
      replace(/"/g, '&quot;').
      replace(/'/g, '&#039;');
  }