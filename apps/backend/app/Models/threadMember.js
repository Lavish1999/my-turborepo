'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class ThreadMember extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            models.ThreadMember.belongsTo(models.User,{foreignKey : "user_id"})
            models.ThreadMember.belongsTo(models.Thread,{foreignKey : "thread_id"})
            models.ThreadMember.hasMany(models.ThreadMessage,{foreignKey : "thread_id"})
        }
    };
    ThreadMember.init({
        thread_id: DataTypes.INTEGER,
        user_id: DataTypes.INTEGER,
        privilege: DataTypes.ENUM('owner','viewer','editor')
    }, {
        sequelize,
        modelName: 'ThreadMember',
        tableName: 'qa_thread_members',
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        underscored: true,
    });
    return ThreadMember;
};