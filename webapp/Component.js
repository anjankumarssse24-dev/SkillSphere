sap.ui.define([
  "sap/ui/core/UIComponent",
  "skillsphere/model/models",
  "sap/ui/model/json/JSONModel",
  "skillsphere/service/DataManager"
], function (UIComponent, models, JSONModel, DataManagerModule) {
  "use strict";

  return UIComponent.extend("skillsphere.Component", {
    metadata: {
      manifest: "json",
      interfaces: ["sap.ui.core.IAsyncContentCreation"]
    },

    init: function () {
      UIComponent.prototype.init.apply(this, arguments);

      this.setModel(models.createDeviceModel(), "device");
      this._initializeModels();
      this.getRouter().initialize();
    },

    _initializeModels: function () {
      var currentUserModel = new JSONModel({
        id: null,
        name: null,
        role: null,
        isLoggedIn: false
      });
      this.setModel(currentUserModel, "currentUser");

      var viewStateModel = new JSONModel({
        busy: false,
        message: null
      });
      this.setModel(viewStateModel, "viewState");

      var DataManager = DataManagerModule.DataManager || DataManagerModule.default || DataManagerModule;
      window.dataManager = DataManager.getInstance();

      console.log("Models initialized - using OData service for data");
    }
  });
});
