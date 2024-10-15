'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class SessionMessageExt extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
        }
    };
    SessionMessageExt.init({
        session_id: DataTypes.INTEGER,
        integration_id: DataTypes.STRING,
        scenario_id : DataTypes.STRING,
        node_id : DataTypes.STRING,
        provider_message_id : DataTypes.STRING,
        scenario_stack: DataTypes.JSON,
    }, {
        sequelize,
        modelName: 'SessionMessageExt',
        timestamps: { createdAt: 'created_at'},
        updatedAt: false,
        underscored: true,
    });
    return SessionMessageExt;
};