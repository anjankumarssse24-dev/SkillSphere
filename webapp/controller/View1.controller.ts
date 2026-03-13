import ComboBox from "sap/m/ComboBox";
import Controller from "sap/ui/core/mvc/Controller";
import MessageBox from "sap/m/MessageBox";
import RadioButtonGroup from "sap/m/RadioButtonGroup";
import Input from "sap/m/Input";
import TextArea from "sap/m/TextArea";

/**
 * @namespace project1.controller
 */
export default class View1 extends Controller {

    /*eslint-disable @typescript-eslint/no-empty-function*/
    public onInit(): void {
        // Initialization code (if needed)
    }

    public onPress(): void {
        const page = this.getView();
        if (!page) {
            MessageBox.error("View not found.");
            return;
        }
        const comboBox = page.byId("titleComboBox") as ComboBox;
        let titleValue = "";
        if (comboBox) {
            const selectedItem = comboBox.getSelectedItem();
            titleValue = selectedItem ? selectedItem.getText() : "";
        }
        const inputField = page.byId("inputField") as Input;
        const inputValue = inputField ? inputField.getValue() : "";
        const inputField2 = page.byId("inputField2") as Input;
        const inputValue2 = inputField2 ? inputField2.getValue() : "";
        const groupA = page.byId("GroupA") as RadioButtonGroup;
        let selectedText = "None";
        if (groupA) {
            const selectedIndex = groupA.getSelectedIndex();
            const selectedButton = groupA.getButtons()[selectedIndex];
            selectedText = selectedButton ? selectedButton.getText() : "None";
        }
        const textArea = page.byId("textAreaInput") as TextArea;
        const textAreaValue = textArea ? textArea.getValue() : "";

    const details = `Title: ${titleValue}\nName: ${inputValue}\nI Num: ${inputValue2}\nLocation: ${selectedText}\nText: ${textAreaValue}`;
    MessageBox.information(details, { title: "Enter Details" });
    }
}
