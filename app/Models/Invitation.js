'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class Invitation extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
        }
    };
    Invitation.init({
        organization_id: DataTypes.INTEGER,
        project_id: DataTypes.INTEGER,
        type: DataTypes.ENUM('project','organization'),
        sent_by: DataTypes.INTEGER,
        sent_to: DataTypes.STRING,
        email: DataTypes.STRING,
        role: DataTypes.STRING,
        hash: DataTypes.STRING,
        status: DataTypes.ENUM('pending', 'accepted'),

    }, {
        sequelize,
        modelName: 'Invitation',
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        underscored: true
    });
    return Invitation;
};