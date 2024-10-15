'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class ThreadInvitation extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            models.ThreadInvitation.belongsTo(models.Thread,{foreignKey : "thread_id"})
        }
    };
    ThreadInvitation.init({
        thread_id: DataTypes.INTEGER,
        send_by: DataTypes.INTEGER,
        send_to:DataTypes.STRING,
        status:DataTypes.ENUM('pending','accepted'),
        privilege:DataTypes.ENUM('owner','viewer','editor'),
        hash : DataTypes.STRING,
    }, {
        sequelize,
        modelName: 'ThreadInvitation',
        tableName: 'qa_thread_invitations',
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        underscored: true,
    });
    return ThreadInvitation;
};