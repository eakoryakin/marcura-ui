angular.module('marcuraUI.components').directive('maRadioBox', ['MaHelper', '$timeout', '$sce', 'MaValidators', function (MaHelper, $timeout, $sce, MaValidators) {
    var radioBoxes = {};

    return {
        restrict: 'E',
        scope: {
            item: '=',
            itemTemplate: '=',
            itemTextField: '@',
            itemValueField: '@',
            value: '=',
            isDisabled: '=',
            hideText: '=',
            change: '&',
            size: '@',
            isRequired: '=',
            validators: '=',
            instance: '=',
            id: '@',
            modifier: '@'
        },
        replace: true,
        template: function () {
            var html = '\
            <div class="ma-radio-box{{cssClass}}"\
                ng-focus="onFocus()"\
                ng-blur="onBlur()"\
                ng-keypress="onKeypress($event)"\
                ng-click="onChange()"\
                ng-class="{\
                    \'ma-radio-box-is-checked\': isChecked(),\
                    \'ma-radio-box-is-disabled\': isDisabled,\
                    \'ma-radio-box-has-text\': hasText(),\
                    \'ma-radio-box-is-focused\': isFocused,\
                    \'ma-radio-box-is-invalid\': !isValid,\
                    \'ma-radio-box-is-touched\': isTouched\
                }">\
                <span class="ma-radio-box-text" ng-bind-html="getItemText()"></span>\
                <div class="ma-radio-box-inner"></div>\
                <i class="ma-radio-box-icon" ng-show="isChecked()"></i>\
            </div>';

            return html;
        },
        link: function (scope, element, attributes) {
            var valuePropertyParts = null,
                isStringArray = !scope.itemTextField && !scope.itemValueField,
                validators = scope.validators ? angular.copy(scope.validators) : [],
                isRequired = scope.isRequired,
                hasIsNotEmptyValidator = false;

            var setModifiers = function (oldModifiers) {
                // Remove previous modifiers first.
                if (!MaHelper.isNullOrWhiteSpace(oldModifiers)) {
                    oldModifiers = oldModifiers.split(' ');

                    for (var i = 0; i < oldModifiers.length; i++) {
                        element.removeClass('ma-radio-box-' + oldModifiers[i]);
                    }
                }

                var modifiers = '';

                if (!MaHelper.isNullOrWhiteSpace(scope.modifier)) {
                    modifiers = scope.modifier.split(' ');
                }

                for (var j = 0; j < modifiers.length; j++) {
                    element.addClass('ma-radio-box-' + modifiers[j]);
                }
            };

            var setTabindex = function () {
                if (scope.isDisabled) {
                    element.removeAttr('tabindex');
                } else {
                    element.attr('tabindex', '0');
                }
            };

            var getControllerScope = function () {
                var controllerScope = null,
                    initialScope = scope.$parent,
                    property = attributes.value;

                // In case of a nested property binding like 'company.port.id'.
                if (property.indexOf('.') !== -1) {
                    valuePropertyParts = property.split('.');
                    property = valuePropertyParts[0];
                }

                while (initialScope && !controllerScope) {
                    if (initialScope.hasOwnProperty(property)) {
                        controllerScope = initialScope;
                    } else {
                        initialScope = initialScope.$parent;
                    }
                }

                return controllerScope;
            };

            var controllerScope = getControllerScope();

            scope._size = scope.size ? scope.size : 'xs';
            scope.cssClass = ' ma-radio-box-' + scope._size;
            scope.isFocused = false;
            scope.isValid = true;
            scope.isTouched = false;

            if (scope.id) {
                if (!radioBoxes[scope.id]) {
                    radioBoxes[scope.id] = [];
                }

                radioBoxes[scope.id].push(scope);
            }

            var validate = function (value) {
                if (radioBoxes[scope.id]) {
                    // Validate a group of components.
                    for (var i = 0; i < radioBoxes[scope.id].length; i++) {
                        var radioBox = radioBoxes[scope.id][i];
                        radioBox.isTouched = true;
                        radioBox.validateThis(radioBox.value);
                    }
                } else {
                    // Validate only the current component.
                    scope.isTouched = true;
                    scope.validateThis(value);
                }
            };

            scope.validateThis = function (value) {
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

            scope.getItemText = function () {
                if (scope.hideText) {
                    return MaHelper.html.nbsp;
                }

                var text;

                if (scope.itemTemplate) {
                    text = scope.itemTemplate(scope.item);
                } else if (isStringArray) {
                    text = scope.item;
                } else if (scope.itemTextField) {
                    text = scope.item[scope.itemTextField];
                }

                if (!angular.isString(text) || !text) {
                    text = MaHelper.html.nbsp;
                }

                return $sce.trustAsHtml(text);
            };

            scope.hasText = function () {
                return scope.getItemText() !== MaHelper.html.nbsp;
            };

            scope.isChecked = function () {
                if (isStringArray) {
                    return scope.item === scope.value;
                } else if (scope.itemValueField) {
                    return scope.item && scope.value &&
                        scope.item[scope.itemValueField] === scope.value[scope.itemValueField];
                }

                return false;
            };

            scope.onChange = function () {
                if (scope.isDisabled) {
                    return;
                }

                var valueProperty,
                    oldValue = scope.value;
                scope.value = scope.item;

                if (controllerScope && valuePropertyParts) {
                    // When the component is inside ng-repeat normal binding like
                    // value="port" won't work.
                    // This is to workaround the problem.
                    valueProperty = controllerScope;

                    // Handle nested property binding.
                    for (var i = 0; i < valuePropertyParts.length; i++) {
                        valueProperty = valueProperty[valuePropertyParts[i]];
                    }

                    valueProperty = scope.item;
                } else {
                    valueProperty = controllerScope[attributes.value];
                    controllerScope[attributes.value] = scope.item;
                }

                // Check that value has changed.
                var hasChanged = true;

                if (isStringArray) {
                    hasChanged = oldValue !== scope.item;
                } else if (scope.itemValueField) {
                    if (!oldValue && !MaHelper.isNullOrWhiteSpace(scope.item[scope.itemValueField])) {
                        hasChanged = true;
                    } else {
                        hasChanged = oldValue[scope.itemValueField] !== scope.item[scope.itemValueField];
                    }
                } else {
                    // Compare objects if itemValueField is not provided.
                    if (!oldValue && scope.item) {
                        hasChanged = true;
                    } else {
                        hasChanged = JSON.stringify(oldValue) === JSON.stringify(scope.item);
                    }
                }

                if (hasChanged) {
                    $timeout(function () {
                        validate(scope.value);

                        scope.change({
                            maValue: scope.item,
                            maOldValue: oldValue
                        });
                    });
                }
            };

            scope.onFocus = function () {
                if (!scope.isDisabled) {
                    scope.isFocused = true;
                }
            };

            scope.onBlur = function () {
                if (scope.isDisabled) {
                    return;
                }

                scope.isFocused = false;

                validate(scope.value);
            };

            scope.onKeypress = function (event) {
                if (event.keyCode === MaHelper.keyCode.space) {
                    // Prevent page from scrolling down.
                    event.preventDefault();

                    if (!scope.isDisabled && !scope.isChecked()) {
                        scope.onChange();
                    }
                }
            };

            scope.$watch('isDisabled', function (newValue, oldValue) {
                if (newValue === oldValue) {
                    return;
                }

                if (newValue) {
                    scope.isFocused = false;
                }

                setTabindex();
            });

            scope.$watch('modifier', function (newValue, oldValue) {
                if (newValue === oldValue) {
                    return;
                }

                setModifiers(oldValue);
            });

            // Set up validators.
            for (var i = 0; i < validators.length; i++) {
                if (validators[i].name === 'IsNotEmpty') {
                    hasIsNotEmptyValidator = true;
                    break;
                }
            }

            if (!hasIsNotEmptyValidator && isRequired) {
                validators.unshift(MaValidators.isNotEmpty());
            }

            if (hasIsNotEmptyValidator) {
                isRequired = true;
            }

            // Prepare API instance.
            if (scope.instance) {
                scope.instance.isInitialized = true;

                scope.instance.isEditor = function () {
                    return true;
                };

                scope.instance.isValid = function () {
                    return scope.isValid;
                };

                scope.instance.validate = function () {
                    validate(scope.value);
                };
            }

            $timeout(function () {
                // Now id is used only for grouping radioBoxes, so remove it from the element.
                if (scope.id) {
                    element.removeAttr('id');
                }

                setModifiers();
            });

            setTabindex();
        }
    };
}]);