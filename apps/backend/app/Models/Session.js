'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class Session extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            this.myAssociation=models.Session.belongsTo(models.Contact, { as: 'contact', foreignKey: "contact_id"});
            this.myAssociation=models.Session.hasMany(models.SessionLead, { as: 'session_lead', foreignKey: "session_id"});
            models.Session.belongsTo(models.Project , {foreignKey : "project_id",as:"project_session"})
            models.Session.hasMany(models.SessionMessage , {foreignKey : "session_id",as:"session_messages"})
            models.Session.hasMany(models.SessionWebsiteNavigation , {foreignKey : "session_id",as:"SessionWebsiteNavigation"})
            models.Session.belongsTo(models.ChatbotIntegrationsSetting , {targetKey: 'project_id',foreignKey : "project_id",as:"ChatbotIntegrationsSetting"})
            models.Session.hasMany(models.ShareLinkIntegrationSetting , {sourceKey : "project_id",foreignKey : "project_id"})
            models.Session.belongsTo(models.Visitor , {foreignKey : "visitor_id",as:"visitor_data"})
            models.Session.belongsTo(models.Contact,{foreignKey:"contact_id",as:"contact_data"})
            models.FlowExecution.belongsTo(models.Session , {foreignKey : "session_id",as:"session_data"})
            models.Session.hasOne(models.EmailIntegration , {sourceKey : "project_id", foreignKey : "project_id",as:"projectEmailIntegration"})
            models.Session.hasOne(models.SessionMeta , {foreignKey : "session_id",as:"session_meta"})
            models.SessionMessagesMeta.belongsTo(models.Session , {foreignKey : "session_id",as:"message_meta_session_data"})
            models.ChatbotExecutionLog.belongsTo(models.Session , {foreignKey : "session_id",as:"executionlog_session_data"})
        }
    };
    Session.init({
        project_id :DataTypes.INTEGER,
        integration_id: DataTypes.INTEGER,
        status: DataTypes.ENUM('open','closed'),
        device_type: DataTypes.ENUM('desktop','mobile'),
        platform: DataTypes.ENUM('android', 'ios', 'window', 'linux','mac'),
        ip: DataTypes.STRING,
        country: DataTypes.STRING,
        session_uid:{
            type: DataTypes.BIGINT,
            get() {
                const session_uid = this.getDataValue('session_uid');
                return typeof session_uid == "string" ? Number(session_uid) : session_uid;
            }
        },
        contact_id : DataTypes.INTEGER,
        provider_session_id : DataTypes.STRING,
        is_notified: DataTypes.INTEGER,
        chat_mode : DataTypes.ENUM('2','1','3'), // 1 bot mode, 2 awaiting, 3 operator mode
        visitor_id : DataTypes.INTEGER,
        state : DataTypes.ENUM('resolved', 'pending', 'unresolved'),
        is_emulator : DataTypes.BOOLEAN,
        data : DataTypes.JSON,
        segment : DataTypes.STRING,
        language : DataTypes.STRING
    }, {
        sequelize,
        modelName: 'Session',
        tableName: 'session',
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at'},
        underscored: true,
    });
    return Session;
};