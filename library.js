/*!
 * ${copyright}
 */

/**
 * Initialization Code and shared classes of library com.PwCLib.
 */
sap.ui.define([
	"sap/ui/core/library",
	"sap/ui/core/Core",
	"sap/m/MessagePopover",
	"sap/m/MessageToast",
	"sap/ui/export/Spreadsheet",
	"sap/ui/core/MessageType",
	"sap/ui/core/routing/HashChanger",
	"./xlsx.full.min"

], function (Library, Core, MessagePopover, MessageToast, Spreadsheet, MessageType, HashChanger, XLSX) {
	"use strict";

	// delegate further initialization of this library to the Core
	// Hint: sap.ui.getCore() must still be used to support preload with sync bootstrap!
	sap.ui.getCore().initLibrary({
		name: "com.PwCLib",
		version: "${version}",
		dependencies: [ // keep in sync with the ui5.yaml and .library files
			"sap.ui.core"
		],
		types: [
			// "com.PwCLib.ExampleColor"
		],
		interfaces: [],
		controls: [
			"com.PwCLib.CustomDateRange",
			"com.PwCLib.CustomShellBar",
			"com.PwCLib.customtable.CustomTable",
			"com.PwCLib.customtable.Column",
			"com.PwCLib.customtable.MenuFilterItem",
			"com.PwCLib.customtable.Row"
		],
		elements: [],
		noLibraryCSS: false // if no CSS is provided, you can disable the library.css load here
	});

	var thisLib = com.PwCLib;
	thisLib.XLSX = this.XLSX;
	
	// 엑셀 import json data
	thisLib.excelData = {};

	// tree table level 초기화
	thisLib.maxTreeLevel = 0;

	thisLib.oMsgModel = new sap.ui.model.json.JSONModel();
	thisLib.oViewTypeModel = new sap.ui.model.json.JSONModel();
	thisLib.oAfterSearchModel = new sap.ui.model.json.JSONModel();


	// messagebundle.properties에 정의된 메시지를 가져온다
	thisLib.fnGetCommonMsg = function (sMsgId) {
		return sap.ui.getCore().getLibraryResourceBundle("com.PwCLib").getText(sMsgId);
	};

	// 특정 오브젝트의 텍스트(label 등) messagebundle.properties에 정의된 메시지로 세팅
	thisLib.fnSetObjMsg = function (obj, sMsgId) {
		obj.setText(sap.ui.getCore().getLibraryResourceBundle("com.PwCLib").getText(sMsgId));
	};

	// 화면 view type 세팅 ("display", "create", "update")
	thisLib.fnSetViewType = function (sViewType, oView) {
		this.oViewTypeModel.setProperty("/", sViewType);
		oView.setModel(this.oViewTypeModel, "viewType");
	};

	// 화면 view type 세팅 ("display", "create", "update")
	thisLib.fnAfterSearchType = function (bType, oView) {
		this.oAfterSearchModel.setProperty("/", bType);
		oView.setModel(this.oViewTypeModel, "afterSearchType");
	};

	// 콤보박스에 '전체' 항목 추가
	thisLib.fnAddComboItem = function (obj) {
		obj.onBeforeRendering = function () {
			var sSelectAll = sap.ui.getCore().getLibraryResourceBundle("com.PwCLib").getText("SELECT_ALL");
			var oSelectItem = new sap.ui.core.Item({
				key: "",
				text: sSelectAll
			});
			obj.insertItem(oSelectItem);
			obj.setSelectedKey("");
		};

	};

	// tree 테이블을 위한 tree data 생성 (oData -> JSON)
	thisLib.fnGetChild = function (oModel, sEnityType, aKey, aSource, nLevel, aSumCols) {
		nLevel++;
		if (!aKey[nLevel]) {
			return;
		}

		var aReturn = [];
		var sCurrentKey = aKey[nLevel]; //Key1
		var aTempKeys = [];

		aSource.forEach(function (oItem) {
			if (!aTempKeys.includes(oItem[sCurrentKey])) {
				aTempKeys.push(oItem[sCurrentKey]);
			}
		})

		aTempKeys.forEach(function (sValue) {
			var aTempFilter = aSource.filter(function (oItem) {
				if (oItem[sCurrentKey] === sValue) return true;
			})

			var aResult = thisLib.fnGetChild(oModel, sEnityType, aKey, aTempFilter, nLevel, aSumCols);
			var bLeaf = false;

			if (!aResult) {
				bLeaf = true;
			}

			var sLabel = this.fnGetMetadatLabel(oModel, sEnityType, sCurrentKey);

			var oReturn = {
				level: nLevel,
				key: sCurrentKey,
				value: sValue,
				// leaf: bLeaf,
				label: sLabel,
				// data  : aTempFilter,
				childNodes: aResult
			};

			if (bLeaf) {
				aTempFilter[0].leaf = bLeaf;
				oReturn.childNodes = aTempFilter;
				this.maxTreeLevel = nLevel + 1;
			}


			aSumCols.forEach(function (oCol) {
				aTempFilter.forEach(function name(oFilter) {
					if (oReturn[oCol] === undefined) {
						oReturn[oCol] = 0;
					}
					if (oFilter[oCol] === undefined) {
						oFilter[oCol] = 0;
					}
					oReturn[oCol] += parseInt(oFilter[oCol]);
				})
			});



			aReturn.push(oReturn);

		}.bind(this));


		return aReturn;
	};

	// footer에 표시되는 에러메시지 생성
	thisLib.fnCreateMessgePopover = function (aMessages, oTarget) {
		var oMessageTemplate = new sap.m.MessageItem({
			type: "Error",
			title: "{title}",
			description: "{description}"
		});

		this.oMsgPopover = new sap.m.MessagePopover({
			items: {
				path: "/",
				template: oMessageTemplate
			}
		});

		this.oMsgModel.setData(aMessages);
		this.oMsgPopover.setModel(this.oMsgModel);
		oTarget.setText(sap.ui.getCore().getLibraryResourceBundle("com.PwCLib").getText("ERROR_OCCURS"));
		oTarget.setVisible(true);
		this.fnMessagePopoverToggle(oTarget);
	};

	// footer 메시지팝업 toggle
	thisLib.fnMessagePopoverToggle = function (oTarget) {
		this.oMsgPopover.toggle(oTarget);
	};

	// request로 전달된 에러텍스트로 에러메시지 생성
	thisLib.fnMakeErrorMsg = function (oErrorMsgArr, oTarget, aFormGroupElements) {
		var sErrMsg = "";
		var sErrMsgTarget = "";
		var aMessages = [];

		oErrorMsgArr.forEach(function (descErrMsg) {
			sErrMsg = descErrMsg.message;
			sErrMsgTarget = descErrMsg.target;

			aMessages.push({
				type: MessageType.Error,
				title: sErrMsg,
				description: sErrMsg,
				target: sErrMsgTarget,
				active: true
			});

		});
		oTarget.setVisible(true);
		thisLib.fnCreateMessgePopover(aMessages, oTarget);

		if (aFormGroupElements !== undefined) {
			thisLib.fnMessageFocus(aMessages, aFormGroupElements);
		}


	};

	// 테이블 조회, 수정 모드 전환
	thisLib.setCustomColumnEdit = function (aColumns, bEdit) {
		for (var i = 0; i < aColumns.length; i++) {

			var oCustomData = aColumns[i].data("p13nData");

			if (oCustomData.customField) {
				if (bEdit) {
					//수정 모드일 때
					aColumns[i].setVisible(oCustomData.customEditMode);
				} else {
					// 조회 모드 일 때
					aColumns[i].setVisible(oCustomData.customDisplayMode);
				}
			}
		}
	}

	// setTempColumns function에서 ojbect에 text 및 value 바인딩
	thisLib._setPartsBinding = function (oSourceObj, sBindngAttribute, sJsonModelName) {
		var sBindFunc;
		switch (sBindngAttribute) {
			case 'value':
				sBindFunc = "bindValue";
				break;
			case 'text':
				sBindFunc = "bindText";
				break;
		}

		if (oSourceObj[sBindFunc]) {
			var aParts = oSourceObj.mBindingInfos[sBindngAttribute].parts
			for (var j = 0; j < aParts.length; j++) {
				aParts[j].model = sJsonModelName;
			}
			oSourceObj[sBindFunc].apply(oSourceObj, [{
				parts: aParts
			}]);
		}
	};

	// 테이블 수정모드에서 object template에 값 바인딩
	thisLib.setTempColumns = function (oTable, sJsonModelName) {
		var aColumns = oTable.getColumns();
		thisLib.setCustomColumnEdit(aColumns, false);

		for (var i = 0; i < aColumns.length; i++) {
			if (aColumns[i].data("p13nData")) {
				// var sPath = `${sJsonModelName}>${aColumns[i].data("p13nData").columnKey}`;

				if (aColumns[i].getTemplate().getDisplay) {
					var oDisplay = aColumns[i].getTemplate().getDisplay();
					thisLib._setPartsBinding(oDisplay, "text", sJsonModelName);

					var aItemsDisplay = oDisplay.getAggregation('items');
					if (aItemsDisplay) {
						for (var j = 0; j < aItemsDisplay.length; j++) {
							const oItem = aItemsDisplay[j];

							thisLib._setPartsBinding(oItem, "text", sJsonModelName);
							thisLib._setPartsBinding(oItem, "value", sJsonModelName);
						}
					}
				}

				if (aColumns[i].getTemplate().getEdit) {
					var oEdit = aColumns[i].getTemplate().getEdit();

					thisLib._setPartsBinding(oEdit, "value", sJsonModelName);

					var aItemsEdit = oEdit.getAggregation('items');
					if (aItemsEdit) {
						for (var j = 0; j < aItemsEdit.length; j++) {
							const oItem = aItemsEdit[j];

							thisLib._setPartsBinding(oItem, "text", sJsonModelName);
							thisLib._setPartsBinding(oItem, "value", sJsonModelName);
						}
					}
				}
			}
		}
	};

	// 엑셀 custom export (일반 테이블)
	thisLib.fnExcelExport = function (oModel, oTable, sEntitySet) {
		var oMetaModel = oModel.getMetaModel();
		var sEntityType = oMetaModel.getODataEntitySet(sEntitySet).entityType;

		var sType = "string";
		var aColumns = oTable.getColumns();
		var oBindingContexts = oTable.getBinding("rows").getContexts();
		var aExcelCols = [];
		var aExcelDataSrc = [];
		var oRowData = {};
		var colsProperty = {};

		aColumns.forEach(function (oColumn) {
			console.log(oColumn.getLabel().getText());
			var columnOdataProperty = oMetaModel.getODataProperty(oMetaModel.getODataEntityType(sEntityType), oColumn.getCustomData()[0].getProperty("value").columnKey);

			if (columnOdataProperty !== null) {
				sType = oMetaModel.getODataProperty(oMetaModel.getODataEntityType(sEntityType), oColumn.getCustomData()[0].getProperty("value").columnKey).type;

				if (sType === "Edm.Decimal") {
					sType = "number";
				} else if (sType === "Edm.DateTime") {
					sType = "date";
				} else {
					sType = "string";
				}
			}
			console.log(sType);

			colsProperty = {
				label: oColumn.getLabel().getText(),
				property: oColumn.getCustomData()[0].getProperty("value").columnKey,
				type: sType
			}

			if (sType === "number") {
				colsProperty.delimiter = true;
			}

			aExcelCols.push(colsProperty);
		});

		oBindingContexts.forEach(function (oBindingContext) {
			oRowData = oBindingContext.getObject();
			// delete oRowData.__metadata;
			aExcelDataSrc.push(oRowData);
		});

		var oSettings = {
			workbook: {
				columns: aExcelCols
			},
			dataSource: aExcelDataSrc
		};

		var oSheet = new Spreadsheet(oSettings);

		oSheet.build().then(function () {
			var sSuccessMessage = sap.ui.getCore().getLibraryResourceBundle("com.PwCLib").getText("EXCEL_EXPORT_SUCCESS");
			MessageToast.show(sSuccessMessage);
		}).finally(function () {
			oSheet.destroy();
		});

	};

	
	// 엑셀 custom export (tree 테이블)
	thisLib.fnTreeTableExcelExport = function (oModel, oTable, sEntitySet, dataSource) {
		var oMetaModel = oModel.getMetaModel();
		var aColumns = oTable.getColumns();

		var aExcelCols = [];
		var sEntityType = "";
		var sType = "";

		var sBindingPath = "";
		var iColIndex = 0;

		var colsProperty = {};

		aColumns.forEach(function (oColumn) {
			sEntityType = oMetaModel.getODataEntitySet(sEntitySet).entityType;
			sBindingPath = oColumn.getTemplate().getBindingPath("text");

			if (iColIndex > 0) {
				if (sBindingPath) {
					sType = oMetaModel.getODataProperty(oMetaModel.getODataEntityType(sEntityType), sBindingPath).type;
				}

				if (sType === "Edm.Decimal") {
					sType = "number";
				} else if (sType === "Edm.DateTime") {
					sType = "date";
				} else {
					sType = "string";
				}

				colsProperty = {
					label: oColumn.getLabel().getText(),
					property: sBindingPath,
					type: sType
				}

				if (sType === "number") {
					colsProperty.delimiter = true;
				}

				aExcelCols.push(colsProperty);
			}

			iColIndex++;
		});

		var oSettings = {
			workbook: {
				columns: aExcelCols
			},
			dataSource: dataSource
		};

		var oSheet = new Spreadsheet(oSettings);

		oSheet.build().then(function () {
			var sSuccessMessage = sap.ui.getCore().getLibraryResourceBundle("com.PwCLib").getText("EXCEL_EXPORT_SUCCESS");
			MessageToast.show(sSuccessMessage);
		}).finally(function () {
			oSheet.destroy();
		});
	};

	// 엑셀 import
	thisLib.fnExcelImport = function (oController, file, fnCallback) {
		var excelData = {};

		if (file && window.FileReader) {
			var reader = new FileReader();

			reader.onload = function (e) {
				var data = e.target.result;
				var workbook = this.XLSX.read(data, {
					type: 'binary'
				});

				console.log(workbook);

				workbook.SheetNames.forEach(function (sheetName) {
					// Here is your object for every sheet in workbook
					excelData = this.XLSX.utils.sheet_to_row_object_array(workbook.Sheets[sheetName]);

				}.bind(this));

				console.log(excelData);
				fnCallback(oController, excelData);
			}.bind(this);


			reader.readAsArrayBuffer(file);
		}

	};

	// 숫자 => 통화 (ex : 10000 => 10,000)
	thisLib.fnMakeCurrencyVal = function (oEvent) {
		var inputValue = oEvent.getParameter('value').trim().replaceAll(",", "");
		var newValue = inputValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
		oEvent.getSource().setValue(newValue);

	};

	// 에러 필드로 포커싱
	thisLib.fnMessageFocus = function (aMessages, aFormGroupElements) {
		aMessages.forEach(function (message) {
			aFormGroupElements.forEach(function (groupElement) {
				var sPath = groupElement.getElements()[0].getBindingInfo("value").parts[0].path;
				if (sPath.toUpperCase() === message.target.toUpperCase()) {
					groupElement.getElements()[0].setValueState("Error");
					groupElement.getElements()[0].setValueStateText(message.title);
				}
			});
		});
	}

	// 로그아웃
	thisLib.onLogOut = function (oEvent, oView) {
		oView.setBusy(true);

		$.ajax({
			type: "GET",
			url: "/sap/public/bc/icf/logoff", //Clear SSO cookies: SAP Provided service to do that
		}).done(function (data) { //Now clear the authentication header stored in the browser
			if (!document.execCommand("ClearAuthenticationCache")) {
				//"ClearAuthenticationCache" will work only for IE. Below code for other browsers
				$.ajax({
					type: "GET",
					url: "/sap/opu/odata/SAP/zscof_srv/", //any URL to a Gateway service
					username: 'dummy', //dummy credentials: when request fails, will clear the authentication header
					password: 'dummy',
					statusCode: {
						401: function () {
							//This empty handler function will prevent authentication pop-up in chrome/firefox
						}
					},
					error: function () {
						var myVar = setInterval(function (oEvent) {
							window.location.replace("/sap/bc/ui5_ui5/sap/zmenuapp/index.html");
						}, 3000);
						//alert('reached error of wrong username password')
					}
				});
			}
		})
	};

	// metadata에 정의된 label 값 가져오기
	thisLib.fnGetMetadatLabel = function (oModel, sEntityType, sProperty) {
		return oModel.getMetaModel().getODataProperty(oModel.getMetaModel().getODataEntityType(sEntityType), sProperty)["sap:label"];
	};

	thisLib.fnSetFloatHeaderBar = function (oDynamicPage) {
		function sizeChanged(mParams) {
			var nHeaderZindex = "auto";
			var nPageZindex = "auto";
			var nTitleZindex = "auto";
			var sPosition = "static";

			switch (mParams.name) {
				case "Phone":
					return;
					// break;
				case "Tablet":
					sPosition = "absolute";
					// nPageZindex = 10;
					nTitleZindex = 9;
					nHeaderZindex = 8;
					break;
				case "Desktop":
					sPosition = "absolute";
					// nPageZindex = 10;
					nTitleZindex = 9;
					nHeaderZindex = 8;
					break;
				case "LargeDesktop":
					sPosition = "absolute";
					// nPageZindex = 10;
					nTitleZindex = 9;
					nHeaderZindex = 8;
					break;
			}

			// oSmartFilter.setHSpacing(5);
			// oSmartFilter.setVSpacing(3);
			// oSmartFilter.setDefaultSpan("XL1 L1 M1 S1");

			var oTitle = oDynamicPage.getTitle();
			var domTitle = oTitle.getDomRef();
			domTitle.parentElement.parentElement.style.position = sPosition;
			domTitle.parentElement.parentElement.style.zIndex = nPageZindex;
			domTitle.parentElement.parentElement.style.minHeight = '1rem';
			domTitle.parentElement.parentElement.style.Height = '1rem';

			domTitle.parentElement.style.position = sPosition;
			domTitle.parentElement.style.zIndex = nTitleZindex;
			domTitle.parentElement.style.minHeight = '1px';
			domTitle.parentElement.style.height = '1px';

			domTitle.style.minHeight = '1px';
			domTitle.style.height = '1px';

			var oHeader = oDynamicPage.getHeader();
			var dom = oHeader.getDomRef();
			dom.parentElement.style.position = sPosition;
			dom.parentElement.style.zIndex = nHeaderZindex;
			dom.parentElement.parentElement.style.position = sPosition;
			dom.parentElement.parentElement.style.zIndex = nHeaderZindex;
			dom.parentElement.style.width = "100%";
		}
		sap.ui.Device.media.attachHandler(sizeChanged.bind(this), null, sap.ui.Device.media.RANGESETS.SAP_STANDARD_EXTENDED);

		sizeChanged(sap.ui.Device.media.getCurrentRange(sap.ui.Device.media.RANGESETS.SAP_STANDARD_EXTENDED));
	};

	// main 화면 router 초기화
	thisLib.initRouter = function (oRouter) {
		HashChanger.getInstance().replaceHash("");

		oRouter.initialize();

		var sNextLayout = "OneColumn";
		oRouter.navTo("master", {
			layout: sNextLayout
		}, {}, true);

	};

	thisLib.setGrouped = function (oTable, aInitProperty) {
		// alv 의 그룹 처리
		if (aInitProperty && aInitProperty.length) {
			for (let column of oTable.getColumns()) {
				if (aInitProperty.includes(column.getLeadingProperty())) {
					column.setGrouped(true);
				}
			}
		}

		var aColumnsObj = oTable.getColumns();

		for (let sColumnKey of oTable.getGroupedColumns()) {
			
			var oColumn = aColumnsObj.find((oColumn)=>{
				return oColumn.getId() === sColumnKey
			});

			oColumn.setShowIfGrouped(true)
		}

	}

	thisLib.getALVBindingParamerts = function (oTable) {
		// alv를 위한 바인드 파라미터 처리
		var nGroup = 0;

		if (oTable) {
			nGroup = oTable.getGroupedColumns().length;
		}
		return {
			numberOfExpandedLevels: nGroup,
			autoExpandMode: "Sequential",
			sumOnTop: true
		}
	}


	return thisLib;
});