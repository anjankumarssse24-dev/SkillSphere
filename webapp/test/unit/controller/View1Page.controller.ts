/*global QUnit*/
/* eslint-disable @typescript-eslint/no-explicit-any */

import Controller from "skillsphere/controller/View1.controller";

QUnit.module("View1 Controller");

QUnit.test("I should test the View1 controller", function (assert: any) {
	const oAppController = new Controller("View1");
	oAppController.onInit();
	assert.ok(oAppController);
});