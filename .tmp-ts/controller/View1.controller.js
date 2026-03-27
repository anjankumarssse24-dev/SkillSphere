import Controller from "sap/ui/core/mvc/Controller";
import MessageBox from "sap/m/MessageBox";
/**
 * @namespace project1.controller
 */
export default class View1 extends Controller {
    /*eslint-disable @typescript-eslint/no-empty-function*/
    onInit() {
        // Initialization code (if needed)
    }
    onPress() {
        const page = this.getView();
        if (!page) {
            MessageBox.error("View not found.");
            return;
        }
        const comboBox = page.byId("titleComboBox");
        let titleValue = "";
        if (comboBox) {
            const selectedItem = comboBox.getSelectedItem();
            titleValue = selectedItem ? selectedItem.getText() : "";
        }
        const inputField = page.byId("inputField");
        const inputValue = inputField ? inputField.getValue() : "";
        const inputField2 = page.byId("inputField2");
        const inputValue2 = inputField2 ? inputField2.getValue() : "";
        const groupA = page.byId("GroupA");
        let selectedText = "None";
        if (groupA) {
            const selectedIndex = groupA.getSelectedIndex();
            const selectedButton = groupA.getButtons()[selectedIndex];
            selectedText = selectedButton ? selectedButton.getText() : "None";
        }
        const textArea = page.byId("textAreaInput");
        const textAreaValue = textArea ? textArea.getValue() : "";
        const details = `Title: ${titleValue}\nName: ${inputValue}\nI Num: ${inputValue2}\nLocation: ${selectedText}\nText: ${textAreaValue}`;
        MessageBox.information(details, { title: "Enter Details" });
    }
}
