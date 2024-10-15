'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class ConnectedProject extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {

        }
    };
    ConnectedProject.init({
        project_id: DataTypes.INTEGER,
        connected_project_id: DataTypes.INTEGER
    }, {
        sequelize,
        modelName: 'ConnectedProject',
        timestamps: { createdAt: 'created_at' },
        timestamps:true,
        updatedAt: false,
        underscored: true
    });
    return ConnectedProject;
};