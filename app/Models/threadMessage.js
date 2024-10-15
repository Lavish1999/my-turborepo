'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class ThreadMessage extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            models.ThreadMessage.belongsTo(models.User,{foreignKey : "send_by"})
        }
    };
    ThreadMessage.init({
        thread_id: DataTypes.INTEGER,
        send_by: DataTypes.ENUM('user','assistant','operator'),
        message: DataTypes.TEXT,
        parent_id : DataTypes.INTEGER,
        child_id : DataTypes.TEXT,

        rate:DataTypes.ENUM('0','1'),
        seen: DataTypes.ENUM('0','1'),
        sender_id : DataTypes.INTEGER,
        content_type : DataTypes.STRING,
        choices : DataTypes.JSON,
        targets : DataTypes.JSON,
        url : DataTypes.STRING,
    }, {
        sequelize,
        modelName: 'ThreadMessage',
        tableName: 'qa_thread_messages',
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        underscored: true,
    });
    return ThreadMessage;
};