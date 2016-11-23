angular.module('marcuraUI.components').directive('maTextBox', ['$timeout', 'maHelper', 'maValidators', function($timeout, maHelper, maValidators) {
    return {
        restrict: 'E',
        scope: {
            id: '@',
            type: '@',
            value: '=',
            isDisabled: '=',
            isRequired: '=',
            validators: '=',
            instance: '=',
            change: '&',
            blur: '&',
            focus: '&',
            changeTimeout: '='
        },
        replace: true,
        template: function(element, attributes) {
            var type = attributes.type === 'password' ? 'password' : 'text';

            var html = '\
            <div class="ma-text-box"\
                ng-class="{\
                    \'ma-text-box-is-disabled\': isDisabled,\
                    \'ma-text-box-is-focused\': isFocused,\
                    \'ma-text-box-is-invalid\': !isValid,\
                    \'ma-text-box-is-touched\': isTouched\
                }">\
                <input class="ma-text-box-value" type="' + type + '" id="{{id}}"\
                    type="text"\
                    ng-focus="onFocus()"\
                    ng-blur="onBlur()"\
                    ng-keydown="onKeydown($event)"\
                    ng-disabled="isDisabled"/>\
            </div>';

            return html;
        },
        link: function(scope, element) {
            var valueElement = angular.element(element[0].querySelector('.ma-text-box-value')),
                validators = scope.validators ? angular.copy(scope.validators) : [],
                isRequired = scope.isRequired,
                hasIsNotEmptyValidator = false,
                // Variables keydownValue and keyupValue help track touched state.
                keydownValue,
                keyupValue,
                previousValue,
                changePromise,
                changeTimeout = Number(scope.changeTimeout);

            var validate = function() {
                scope.isValid = true;

                if (validators && validators.length) {
                    for (var i = 0; i < validators.length; i++) {
                        if (!validators[i].validate(valueElement.val())) {
                            scope.isValid = false;
                            break;
                        }
                    }
                }
            };

            var triggerChange = function(value) {
                if (previousValue === value) {
                    return;
                }

                scope.value = value;
                previousValue = value;

                $timeout(function() {
                    scope.change({
                        maValue: value
                    });
                });
            };

            var changeValue = function() {
                scope.isTouched = true;

                validate();

                if (scope.isValid) {
                    triggerChange(valueElement.val());
                }
            };

            scope.isFocused = false;
            scope.isTouched = false;

            // Set up validators.
            for (var i = 0; i < validators.length; i++) {
                if (validators[i].name === 'IsNotEmpty') {
                    hasIsNotEmptyValidator = true;
                    break;
                }
            }

            if (!hasIsNotEmptyValidator && isRequired) {
                validators.unshift(maValidators.isNotEmpty());
            }

            if (hasIsNotEmptyValidator) {
                isRequired = true;
            }

            scope.onFocus = function() {
                scope.isFocused = true;

                scope.focus({
                    maValue: scope.value
                });
            };

            scope.onBlur = function() {
                // Cancel change if it is already in process to prevent the event from firing twice.
                if (changePromise) {
                    $timeout.cancel(changePromise);
                }

                scope.isFocused = false;
                changeValue();
                scope.blur({
                    maValue: scope.value
                });
            };

            scope.onKeydown = function(event) {
                // Ignore tab key.
                if (event.keyCode === maHelper.keyCode.tab || event.keyCode === maHelper.keyCode.shift) {
                    return;
                }

                keydownValue = angular.element(event.target).val();
            };

            // Use input event to support value change from contextual menu,
            // e.g. mouse right click + Cut/Copy/Paste etc.
            valueElement.on('input', function(event) {
                // Ignore tab key.
                if (event.keyCode === maHelper.keyCode.tab || event.keyCode === maHelper.keyCode.shift) {
                    return;
                }

                var hasValueChanged = false;
                keyupValue = angular.element(event.target).val();

                if (keydownValue !== keyupValue) {
                    hasValueChanged = true;
                }

                // Change value after a timeout while the user is typing.
                if (!hasValueChanged) {
                    return;
                }

                if (changeTimeout > 0) {
                    if (changePromise) {
                        $timeout.cancel(changePromise);
                    }

                    changePromise = $timeout(function() {
                        changeValue();
                    }, changeTimeout);
                } else {
                    changeValue();
                }
            });

            $timeout(function() {
                // Move id to input.
                element.removeAttr('id');
                valueElement.attr('id', scope.id);
            });

            scope.$watch('value', function(newValue, oldValue) {
                if (newValue === oldValue) {
                    return;
                }

                var caretPosition = valueElement.prop('selectionStart');

                scope.isValid = true;
                scope.isTouched = false;
                valueElement.val(newValue);

                // Restore caret position.
                valueElement.prop({
                    selectionStart: caretPosition,
                    selectionEnd: caretPosition
                });
            });

            // Set initial value.
            valueElement.val(scope.value);
            validate();
            previousValue = scope.value;

            // Prepare API instance.
            if (scope.instance) {
                scope.instance.isInitialized = true;

                scope.instance.validate = function() {
                    scope.isTouched = true;
                    validate();
                };

                scope.instance.isValid = function() {
                    return scope.isValid;
                };
            }
        }
    };
}]);
