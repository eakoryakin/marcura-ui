angular.module('marcuraUI.components')
    .filter('maSelectBoxOrderBy', ['orderByFilter', function(orderByFilter) {
        return function(items, orderByExpression) {
            if (orderByExpression) {
                return orderByFilter(items, orderByExpression);
            }

            return items;
        };
    }])
    .directive('maSelectBox', ['$document', '$timeout', 'maHelper', 'maValidators', function($document, $timeout, maHelper, maValidators) {
        return {
            restrict: 'E',
            scope: {
                id: '@',
                items: '=',
                value: '=',
                isLoading: '=',
                change: '&',
                blur: '&',
                focus: '&',
                itemTemplate: '=',
                itemTextField: '@',
                itemValueField: '@',
                isDisabled: '=',
                isRequired: '=',
                validators: '=',
                canSearch: '=',
                canAddItem: '=',
                addItemTooltip: '@',
                showAddItemTooltip: '=',
                instance: '=',
                orderBy: '=',
                ajax: '=',
                canReset: '=',
                placeholder: '@',
                textPlaceholder: '@'
            },
            replace: true,
            template: function(element, attributes) {
                var isAjax = !maHelper.isNullOrWhiteSpace(attributes.ajax);

                var html = '\
                    <div class="ma-select-box"\
                        ng-class="{\
                            \'ma-select-box-can-add-item\': canAddItem,\
                            \'ma-select-box-is-text-focused\': isTextFocused,\
                            \'ma-select-box-is-disabled\': isDisabled,\
                            \'ma-select-box-is-invalid\': !isValid,\
                            \'ma-select-box-is-touched\': isTouched,\
                            \'ma-select-box-mode-add\': isAddMode,\
                            \'ma-select-box-mode-select\': !isAddMode,\
                            \'ma-select-box-can-reset\': canReset,\
                            \'ma-select-box-is-reset-disabled\': canReset && !isDisabled && !isResetEnabled(),\
                            \'ma-select-box-is-loading\': isLoading\
                        }">\
                        <div class="ma-select-box-spinner" ng-if="isLoading && !isDisabled">\
                            <div class="pace">\
                                <div class="pace-activity"></div>\
                            </div>\
                        </div>';

                if (isAjax) {
                    html += '<input ui-select2="options"\
                        ng-show="!isAddMode"\
                        ng-disabled="isDisabled"\
                        ng-change="onChange()"\
                        ng-model="selectedItem"\
                        placeholder="{{placeholder}}"/>';
                } else {
                    // Add an empty option (<option></option>) as first item for the placeholder to work.
                    // It's strange, but that's how Select2 works.
                    html += '\
                        <select ui-select2="options"\
                            ng-show="!isAddMode"\
                            ng-disabled="isDisabled"\
                            ng-model="selectedItem"\
                            ng-change="onChange()"\
                            placeholder="{{placeholder}}">\
                            <option></option>\
                            <option ng-repeat="item in items | maSelectBoxOrderBy:orderBy" value="{{getOptionValue(item)}}">\
                                {{formatItem(item)}}\
                            </option>\
                        </select>';
                }

                html += '\
                    <input class="ma-select-box-text" type="text" ng-show="isAddMode"\
                        ng-model="text"\
                        ng-disabled="isDisabled"\
                        ng-focus="onFocus(\'text\')"\
                        placeholder="{{textPlaceholder}}"/>\
                    <ma-button class="ma-button-switch"\
                        ng-if="canAddItem" size="xs" modifier="simple"\
                        tooltip="{{getAddItemTooltip()}}"\
                        right-icon="{{isAddMode ? \'bars\' : \'plus\'}}"\
                        click="toggleMode()"\
                        ng-focus="onFocus()"\
                        is-disabled="isDisabled">\
                    </ma-button>\
                    <ma-button class="ma-button-reset"\
                        ng-show="canReset" size="xs" modifier="simple"\
                        right-icon="times-circle"\
                        click="onReset()"\
                        ng-focus="onFocus()"\
                        is-disabled="!isResetEnabled()">\
                    </ma-button>\
                </div>';

                return html;
            },
            controller: ['$scope', function(scope) {
                // Gets a value from itemValueField if an item is object.
                scope.getItemValue = function(item) {
                    if (!item || !scope.itemValueField) {
                        return null;
                    }

                    // In case of a nested property binding like 'company.port.id'.
                    var parts = scope.itemValueField.split('.'),
                        value = item[parts[0]];

                    for (var i = 1; i < parts.length; i++) {
                        value = value[parts[i]];
                    }

                    if (maHelper.isNullOrUndefined(value)) {
                        return null;
                    }

                    return value.toString();
                };

                // Setting Select2 options does not work from link function, so they are set here.
                scope.options = {};

                if (!scope.canSearch) {
                    scope.options.minimumResultsForSearch = -1;
                }

                // AJAX options.
                if (scope.ajax) {
                    scope.options.ajax = scope.ajax;
                    scope.options.minimumInputLength = 3;
                    scope.options.escapeMarkup = function(markup) {
                        return markup;
                    };
                    scope.options.initSelection = function initSelection(element, callback) {
                        // Run init function only once to set initial port.
                        initSelection.runs = initSelection.runs ? initSelection.runs : 1;

                        if (initSelection.runs === 1 && scope.getItemValue(scope.value)) {
                            var item = angular.copy(scope.value);
                            item.text = scope.itemTemplate ? scope.itemTemplate(item) : item[scope.itemTextField];
                            item.id = scope.getItemValue(item);
                            scope.previousSelectedItem = item;
                            callback(item);
                        } else {
                            callback();
                        }

                        initSelection.runs++;
                    };
                }
            }],
            link: function(scope, element) {
                var textElement = angular.element(element[0].querySelector('.ma-select-box-text')),
                    previousAddedItem = null,
                    switchButtonElement,
                    resetButtonElement,
                    selectElement,
                    selectData,
                    labelElement,
                    isFocusLost = true,
                    isFocusInside = false,
                    showAddItemTooltip = scope.showAddItemTooltip === false ? false : true,
                    validators = scope.validators ? angular.copy(scope.validators) : [],
                    isRequired = scope.isRequired,
                    hasIsNotEmptyValidator = false,
                    previousValue;

                scope.previousSelectedItem = scope.previousSelectedItem || null;
                scope.isAddMode = false;
                scope.formatItem = scope.itemTemplate ||
                    function(item) {
                        if (!item) {
                            return '';
                        }

                        return scope.itemTextField ? item[scope.itemTextField] : item.toString();
                    };
                scope.isTextFocused = false;
                scope.isValid = true;
                scope.isTouched = false;
                scope.isAjax = angular.isObject(scope.ajax);

                var isExistingItem = function(item) {
                    if (!angular.isArray(scope.items)) {
                        return false;
                    }

                    var isItemObject = scope.getItemValue(item) !== null;

                    for (var i = 0; i < scope.items.length; i++) {
                        if (isItemObject) {
                            // Search by value field.
                            if (scope.getItemValue(scope.items[i]) === scope.getItemValue(item)) {
                                return true;
                            }
                        } else {
                            // Search by item itself as text.
                            if (scope.items[i] === item) {
                                return true;
                            }
                        }
                    }

                    return false;
                };

                var getItemByValue = function(itemValue) {
                    if (!itemValue) {
                        return null;
                    }

                    // The list is an array of strings, so value is item itself.
                    if (!scope.itemTextField) {
                        return itemValue;
                    }

                    if (angular.isArray(scope.items)) {
                        for (var i = 0; i < scope.items.length; i++) {
                            if (scope.getItemValue(scope.items[i]) === itemValue.toString()) {
                                return scope.items[i];
                            }
                        }
                    }

                    return null;
                };

                var getNewItem = function(itemText) {
                    // The list is an array of strings, so item should be a simple string.
                    if (!scope.itemTextField) {
                        return itemText;
                    }

                    // The list is an array of objects, so item should be an object.
                    if (itemText) {
                        var item = {};
                        item[scope.itemTextField] = itemText;
                        return item;
                    }

                    return null;
                };

                var setInternalValue = function(item) {
                    if (scope.canAddItem && item) {
                        // Switch mode depending on whether provided item exists in the list.
                        // This allows the component to be displayed in correct mode, let's say, in add mode,
                        // when scope.value is initially a custom value not presented in the list.
                        scope.isAddMode = !isExistingItem(item);
                    }

                    validate(item);

                    if (scope.isAddMode) {
                        if (!item) {
                            scope.text = null;
                        } else {
                            if (scope.itemTextField && item[scope.itemTextField]) {
                                // Item is an object.
                                scope.text = item[scope.itemTextField].toString();
                            } else {
                                // Item is a string.
                                scope.text = item;
                            }
                        }

                        previousAddedItem = item;
                        scope.toggleMode('add');
                    } else {
                        if (!item) {
                            scope.selectedItem = null;
                        } else if (!scope.isAjax) {
                            // Set select value.
                            // When in AJAX mode Select2 sets values by itself.
                            if (scope.getItemValue(item) !== null) {
                                // Item is an object.
                                scope.selectedItem = scope.getItemValue(item);
                            } else if (typeof item === 'string') {
                                // Item is a string.
                                scope.selectedItem = item;
                            }
                        }

                        scope.previousSelectedItem = item;
                        scope.toggleMode('select');
                    }
                };

                var onFocusout = function(event, elementName) {
                    var elementTo = angular.element(event.relatedTarget),
                        selectInputElement = angular.element(selectData.dropdown[0].querySelector('.select2-input'));

                    scope.isTextFocused = false;

                    // Trigger change event for text element.
                    if (elementName === 'text') {
                        isFocusInside = false;

                        // Need to apply changes because onFocusout is triggered using jQuery
                        // (AngularJS does not have ng-focusout event directive).
                        scope.$apply(function() {
                            scope.isTouched = true;
                            var value;

                            if (scope.itemTextField) {
                                if (scope.value && scope.value[scope.itemTextField] === scope.text) {
                                    return;
                                }

                                value = getNewItem(scope.text);
                            } else {
                                if (scope.value === scope.text) {
                                    return;
                                }

                                value = scope.text;
                            }

                            validate(value);

                            if (!scope.isValid) {
                                return;
                            }

                            previousValue = scope.value || null;
                            scope.value = value;
                            previousAddedItem = scope.value;

                            // Postpone change event for $apply (which is being invoked by $timeout)
                            // to have time to take effect and update scope.value,
                            // so both maValue and scope.value have the same values eventually.
                            if (scope.isValid) {
                                $timeout(function() {
                                    scope.change({
                                        maValue: scope.value,
                                        maOldValue: previousValue
                                    });
                                });
                            }
                        });
                    } else if (elementName === 'select') {
                        scope.$apply(function() {
                            scope.isTouched = true;
                        });
                    }

                    // Trigger blur event when focus goes to an element outside the component.
                    if (scope.canAddItem) {
                        // Compare switchButtonElement only if it exists, to avoid comparing
                        // two undefineds: elementTo[0] and switchButtonElement[0].
                        isFocusLost = !isFocusInside &&
                            elementTo[0] !== switchButtonElement[0] &&
                            elementTo[0] !== resetButtonElement[0] &&
                            elementTo[0] !== textElement[0] &&
                            elementTo[0] !== selectData.focusser[0] &&
                            elementTo[0] !== selectInputElement[0];
                    } else {
                        isFocusLost = !isFocusInside &&
                            elementTo[0] !== resetButtonElement[0] &&
                            elementTo[0] !== textElement[0] &&
                            elementTo[0] !== selectData.focusser[0] &&
                            elementTo[0] !== selectInputElement[0];
                    }

                    if (isFocusLost) {
                        scope.blur({
                            maValue: scope.value
                        });
                    }

                    isFocusInside = false;
                };

                var validate = function(value) {
                    scope.isValid = true;

                    if (validators && validators.length) {
                        for (var i = 0; i < validators.length; i++) {
                            if (!validators[i].validate(value)) {
                                scope.isValid = false;
                                break;
                            }
                        }
                    }
                };

                var setFocus = function() {
                    // Focus the right element.
                    if (scope.isAddMode) {
                        textElement.focus();
                        scope.isTextFocused = true;
                    } else {
                        selectElement.select2('focus');
                    }
                };

                scope.isResetEnabled = function() {
                    if (scope.isDisabled) {
                        return false;
                    }

                    // When in add mode check scope.text as user changes it.
                    if (scope.isAddMode) {
                        return !maHelper.isNullOrWhiteSpace(scope.text);
                    }

                    return !maHelper.isNullOrUndefined(scope.value);
                };

                scope.onReset = function() {
                    previousValue = scope.value;
                    scope.value = null;
                    setFocus();

                    $timeout(function() {
                        scope.change({
                            maValue: scope.value,
                            maOldValue: previousValue
                        });
                    });
                };

                scope.onFocus = function(elementName) {
                    if (elementName === 'text') {
                        scope.isTextFocused = true;
                    }

                    if (isFocusLost) {
                        scope.focus({
                            maValue: scope.value
                        });
                    }

                    isFocusLost = false;
                };

                textElement.focusout(function(event) {
                    onFocusout(event, 'text');
                });

                scope.getAddItemTooltip = function() {
                    if (!showAddItemTooltip) {
                        return '';
                    }

                    // \u00A0 Unicode character is used here like &nbsp;.
                    if (scope.isAddMode) {
                        return 'Back\u00A0to the\u00A0list';
                    }

                    return scope.addItemTooltip ? scope.addItemTooltip : 'Add new\u00A0item';
                };

                scope.getOptionValue = function(item) {
                    return scope.itemValueField ? scope.getItemValue(item) : item;
                };

                scope.toggleMode = function(mode) {
                    if (!scope.canAddItem) {
                        return;
                    }

                    if (scope.isAddMode && mode === 'add' || !scope.isAddMode && mode === 'select') {
                        return;
                    }

                    var isInternalCall = false;
                    previousValue = scope.value || null;

                    if (mode === 'select') {
                        scope.isAddMode = false;
                        isInternalCall = true;
                    } else if (mode === 'add') {
                        scope.isAddMode = true;
                        isInternalCall = true;
                    } else {
                        scope.isAddMode = !scope.isAddMode;
                    }

                    // Restore previously selected or added item.
                    if (scope.isAddMode) {
                        // Sometimes select2 remains opened after it has lost focus.
                        // Make sure that it is closed in add mode.
                        if (selectElement) {
                            // selectElement is undefined when scope.toggleMode method
                            // is invoked from setInternalValue initially.
                            selectElement.select2('close');
                        }

                        scope.previousSelectedItem = getItemByValue(scope.selectedItem);
                        scope.value = previousAddedItem;

                        if (scope.value) {
                            scope.text = typeof scope.value === 'string' ? scope.value : scope.value[scope.itemTextField];
                        }
                    } else {
                        previousAddedItem = getNewItem(scope.text);
                        scope.value = scope.previousSelectedItem;
                    }

                    if (!isInternalCall) {
                        $timeout(function() {
                            // Trigger change event as user manually swithces between custom and selected items.
                            scope.change({
                                maValue: scope.value,
                                maOldValue: previousValue
                            });

                            setFocus();
                        });
                    }
                };

                scope.onChange = function() {
                    // Validation is required if the item is a simple text, not a JSON object.
                    var item = maHelper.isJson(scope.selectedItem) ? JSON.parse(scope.selectedItem) : scope.selectedItem;

                    // The change event works differently in AJAX mode.
                    if (scope.isAjax) {
                        // The change event fires first time even if scope.value has not changed.
                        if (item === scope.previousSelectedItem) {
                            return;
                        }

                        // When item is selected, change event fires multiple times.
                        // The last time, when item is an object, is the correct one - all others must be ignored.
                        if (!angular.isObject(item)) {
                            return;
                        }
                    }

                    // Get selected item from items by value field.
                    // There is no 'items' array in AJAX mode.
                    if (!scope.isAjax) {
                        if (scope.itemValueField && !maHelper.isNullOrWhiteSpace(item)) {
                            for (var i = 0; i < scope.items.length; i++) {

                                if (scope.getItemValue(scope.items[i]) === item.toString()) {
                                    item = scope.items[i];
                                    break;
                                }
                            }
                        }
                    }

                    if (!item && !scope.value) {
                        return;
                    }

                    if (scope.itemValueField) {
                        var value = scope.getItemValue(scope.value);

                        if (value && value === scope.getItemValue(item)) {
                            return;
                        }
                    } else if (item === scope.value) {
                        return;
                    }

                    previousValue = scope.value;
                    scope.value = item;
                    scope.previousSelectedItem = item;

                    $timeout(function() {
                        scope.change({
                            maValue: item,
                            maOldValue: previousValue
                        });
                    });
                };

                scope.$watch('value', function(newValue, oldValue) {
                    if (newValue === oldValue) {
                        return;
                    }

                    setInternalValue(newValue);
                });

                // Validate text while it is being typed.
                scope.$watch('text', function(newValue, oldValue) {
                    if (newValue === oldValue) {
                        return;
                    }

                    scope.isTouched = true;
                    validate(newValue);
                });

                // Prepare API instance.
                if (scope.instance) {
                    scope.instance.isInitialized = true;

                    scope.instance.switchToSelectMode = function() {
                        if (scope.isAddMode) {
                            scope.toggleMode('select');
                        }
                    };

                    scope.instance.switchToAddMode = function() {
                        if (!scope.isAddMode) {
                            scope.toggleMode('add');
                        }
                    };

                    scope.instance.isValid = function() {
                        return scope.isValid;
                    };

                    scope.instance.validate = function() {
                        scope.isTouched = true;

                        validate(scope.value);
                    };
                }

                // Create a custom 'IsNotEmpty' validator, which also checks that
                // a selected item is in the list.
                var isNotEmptyAndInListValidator = {
                    name: 'IsNotEmpty',
                    validate: function(value) {
                        if (maHelper.isNullOrWhiteSpace(value)) {
                            return false;
                        }

                        // In select mode check that a selected item is in the list.
                        // In AJAX mode there is no items array and we can not check it.
                        if (!scope.isAjax && !scope.isAddMode && !isExistingItem(value)) {
                            return false;
                        }

                        return true;
                    }
                };

                // Set up validators.
                for (var i = 0; i < validators.length; i++) {
                    if (validators[i].name === 'IsNotEmpty') {
                        hasIsNotEmptyValidator = true;
                        validators[i] = isNotEmptyAndInListValidator;
                        break;
                    }
                }

                if (!hasIsNotEmptyValidator && isRequired) {
                    validators.unshift(isNotEmptyAndInListValidator);
                }

                if (hasIsNotEmptyValidator) {
                    isRequired = true;
                }

                $timeout(function() {
                    // Set initial value.
                    // Value is set inside timeout to ensure that we get the latest value.
                    // If put outside timeout then there could be issues when value is set
                    // from directive's link function, not from controller.
                    setInternalValue(scope.value);

                    selectElement = angular.element(element[0].querySelector('.select2-container'));
                    selectData = selectElement.data().select2;
                    labelElement = $('label[for="' + scope.id + '"]');
                    switchButtonElement = angular.element(element[0].querySelector('.ma-button-switch'));
                    resetButtonElement = angular.element(element[0].querySelector('.ma-button-reset'));

                    // Focus the component when label is clicked.
                    if (labelElement.length > 0) {
                        $($document).on('click', 'label[for="' + scope.id + '"]', function() {
                            setFocus();
                        });
                    }

                    selectData.focusser.on('focus', function() {
                        scope.onFocus('select');
                    });

                    selectData.focusser.on('focusout', function(event) {
                        onFocusout(event, 'select');
                    });

                    selectData.dropdown.on('focus', '.select2-input', function() {
                        // This is required for IE to keep focus when an item is selected
                        // from the list using keyboard.
                        isFocusInside = true;
                        scope.onFocus();
                    });

                    selectData.dropdown.on('focusout', '.select2-input', function(event) {
                        onFocusout(event, 'select');
                    });

                    switchButtonElement.focusout(function(event) {
                        onFocusout(event);
                    });

                    resetButtonElement.focusout(function(event) {
                        onFocusout(event);
                    });

                    // Detect if item in the list is hovered.
                    // This is later used for triggering blur event correctly.
                    selectData.dropdown.on('mouseenter', '.select2-result', function() {
                        isFocusInside = true;
                    });

                    // Detect if select2 mask is hovered.
                    // This is later used for triggering blur event correctly in IE.
                    $($document).on('mouseenter', '.select2-drop-mask', function() {
                        isFocusInside = true;
                    });
                });
            }
        };
    }]);
