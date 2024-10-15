'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class Thread extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            models.Thread.hasMany(models.ThreadMessage,{foreignKey : "thread_id"})
            models.Thread.hasMany(models.ThreadMember,{foreignKey : "thread_id"})
        }
    };
    Thread.init({
        title :DataTypes.INTEGER,
        integration_id: DataTypes.INTEGER,
        project_id: DataTypes.INTEGER,
        status: DataTypes.ENUM('open','closed'),
        device_type: DataTypes.ENUM('desktop','mobile'),
        platform: DataTypes.ENUM('android', 'ios', 'window', 'linux','mac'),
        ip: DataTypes.STRING,
        country: DataTypes.STRING,
        thread_uid:DataTypes.STRING,
        root_node : DataTypes.STRING,
    },{
        sequelize,
        modelName: 'Thread',
        tableName: 'qa_threads',
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        underscored: true
    });
      return Thread;
};