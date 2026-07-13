<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('firstName','lastName','email','username','password','password-confirm'); section>
    <#if section = "header">
        ${msg("registerTitle")}
    <#elseif section = "form">
        <form id="kc-register-form" class="${properties.kcFormClass!}" action="${url.registrationAction}" method="post">
            
            <!-- Business Name -->
            <div class="${properties.kcFormGroupClass!}">
                <div class="${properties.kcLabelWrapperClass!}">
                    <label for="user.attributes.businessName" class="${properties.kcLabelClass!}">
                        Business Name <span class="required">*</span>
                    </label>
                </div>
                <div class="${properties.kcInputWrapperClass!}">
                    <input type="text" id="user.attributes.businessName" 
                           class="${properties.kcInputClass!}" 
                           name="user.attributes.businessName" 
                           value="${(register.formData['user.attributes.businessName']!'')}"
                           placeholder="e.g., Brew House Café"
                           required />
                </div>
            </div>

            <!-- Business Type -->
            <div class="${properties.kcFormGroupClass!}">
                <div class="${properties.kcLabelWrapperClass!}">
                    <label for="user.attributes.businessType" class="${properties.kcLabelClass!}">
                        Business Type <span class="required">*</span>
                    </label>
                </div>
                <div class="${properties.kcInputWrapperClass!}">
                    <select id="user.attributes.businessType" 
                            class="${properties.kcInputClass!}" 
                            name="user.attributes.businessType"
                            required>
                        <option value="">Select type...</option>
                        <option value="Restaurant" <#if (register.formData['user.attributes.businessType']!'') == 'Restaurant'>selected</#if>>Restaurant</option>
                        <option value="Bar" <#if (register.formData['user.attributes.businessType']!'') == 'Bar'>selected</#if>>Bar</option>
                        <option value="School" <#if (register.formData['user.attributes.businessType']!'') == 'School'>selected</#if>>School</option>
                        <option value="Boutique" <#if (register.formData['user.attributes.businessType']!'') == 'Boutique'>selected</#if>>Boutique</option>
                    </select>
                </div>
            </div>

            <!-- Email -->
            <div class="${properties.kcFormGroupClass!}">
                <div class="${properties.kcLabelWrapperClass!}">
                    <label for="email" class="${properties.kcLabelClass!}">
                        ${msg("email")} <span class="required">*</span>
                    </label>
                </div>
                <div class="${properties.kcInputWrapperClass!}">
                    <input type="email" id="email" class="${properties.kcInputClass!}" 
                           name="email" value="${(register.formData.email!'')}" 
                           placeholder="you@example.com"
                           autocomplete="email"
                           aria-invalid="<#if messagesPerField.existsError('email')>true</#if>"
                           required />

                    <#if messagesPerField.existsError('email')>
                        <span class="error-message">
                            ${kcSanitize(messagesPerField.get('email'))?no_esc}
                        </span>
                    </#if>
                </div>
            </div>

            <!-- Phone Number -->
            <div class="${properties.kcFormGroupClass!}">
                <div class="${properties.kcLabelWrapperClass!}">
                    <label for="user.attributes.phoneNumber" class="${properties.kcLabelClass!}">
                        Phone Number <span class="required">*</span>
                    </label>
                </div>
                <div class="${properties.kcInputWrapperClass!}">
                    <input type="tel" id="user.attributes.phoneNumber" 
                           class="${properties.kcInputClass!}" 
                           name="user.attributes.phoneNumber" 
                           value="${(register.formData['user.attributes.phoneNumber']!'')}"
                           placeholder="+256 700 000 000"
                           required />
                </div>
            </div>

            <!-- Payment Type -->
            <div class="${properties.kcFormGroupClass!}">
                <div class="${properties.kcLabelWrapperClass!}">
                    <label for="user.attributes.paymentType" class="${properties.kcLabelClass!}">
                        Payment Method <span class="required">*</span>
                    </label>
                </div>
                <div class="${properties.kcInputWrapperClass!}">
                    <select id="user.attributes.paymentType" 
                            class="${properties.kcInputClass!}" 
                            name="user.attributes.paymentType"
                            onchange="togglePaymentFields(this.value)"
                            required>
                        <option value="">Select payment method...</option>
                        <option value="MOBILE_MONEY" <#if (register.formData['user.attributes.paymentType']!'') == 'MOBILE_MONEY'>selected</#if>>Mobile Money</option>
                        <option value="BANK_ACCOUNT" <#if (register.formData['user.attributes.paymentType']!'') == 'BANK_ACCOUNT'>selected</#if>>Bank Account</option>
                    </select>
                </div>
            </div>

            <!-- Mobile Money Fields -->
            <div id="mobileMoneyFields" style="display: none;">
                <div class="${properties.kcFormGroupClass!}">
                    <div class="${properties.kcLabelWrapperClass!}">
                        <label for="user.attributes.mobileProvider" class="${properties.kcLabelClass!}">
                            Mobile Money Provider
                        </label>
                    </div>
                    <div class="${properties.kcInputWrapperClass!}">
                        <select id="user.attributes.mobileProvider" 
                                class="${properties.kcInputClass!}" 
                                name="user.attributes.mobileProvider">
                            <option value="">Select provider...</option>
                            <option value="MTN" <#if (register.formData['user.attributes.mobileProvider']!'') == 'MTN'>selected</#if>>MTN Mobile Money</option>
                            <option value="AIRTEL" <#if (register.formData['user.attributes.mobileProvider']!'') == 'AIRTEL'>selected</#if>>Airtel Money</option>
                            <option value="AFRICELL" <#if (register.formData['user.attributes.mobileProvider']!'') == 'AFRICELL'>selected</#if>>Africell Money</option>
                        </select>
                    </div>
                </div>

                <div class="${properties.kcFormGroupClass!}">
                    <div class="${properties.kcLabelWrapperClass!}">
                        <label for="user.attributes.mobileNumber" class="${properties.kcLabelClass!}">
                            Mobile Money Number
                        </label>
                    </div>
                    <div class="${properties.kcInputWrapperClass!}">
                        <input type="tel" id="user.attributes.mobileNumber" 
                               class="${properties.kcInputClass!}" 
                               name="user.attributes.mobileNumber" 
                               value="${(register.formData['user.attributes.mobileNumber']!'')}"
                               placeholder="+256 700 000 000" />
                    </div>
                </div>
            </div>

            <!-- Bank Account Fields -->
            <div id="bankFields" style="display: none;">
                <div class="${properties.kcFormGroupClass!}">
                    <div class="${properties.kcLabelWrapperClass!}">
                        <label for="user.attributes.bankName" class="${properties.kcLabelClass!}">
                            Bank Name
                        </label>
                    </div>
                    <div class="${properties.kcInputWrapperClass!}">
                        <input type="text" id="user.attributes.bankName" 
                               class="${properties.kcInputClass!}" 
                               name="user.attributes.bankName" 
                               value="${(register.formData['user.attributes.bankName']!'')}"
                               placeholder="e.g., Stanbic Bank" />
                    </div>
                </div>

                <div class="${properties.kcFormGroupClass!}">
                    <div class="${properties.kcLabelWrapperClass!}">
                        <label for="user.attributes.bankAccountNumber" class="${properties.kcLabelClass!}">
                            Account Number
                        </label>
                    </div>
                    <div class="${properties.kcInputWrapperClass!}">
                        <input type="text" id="user.attributes.bankAccountNumber" 
                               class="${properties.kcInputClass!}" 
                               name="user.attributes.bankAccountNumber" 
                               value="${(register.formData['user.attributes.bankAccountNumber']!'')}"
                               placeholder="Account number" />
                    </div>
                </div>
            </div>

            <!-- Password -->
            <div class="${properties.kcFormGroupClass!}">
                <div class="${properties.kcLabelWrapperClass!}">
                    <label for="password" class="${properties.kcLabelClass!}">
                        ${msg("password")} <span class="required">*</span>
                    </label>
                </div>
                <div class="${properties.kcInputWrapperClass!}">
                    <input type="password" id="password" class="${properties.kcInputClass!}" 
                           name="password" autocomplete="new-password"
                           aria-invalid="<#if messagesPerField.existsError('password','password-confirm')>true</#if>"
                           required />

                    <#if messagesPerField.existsError('password')>
                        <span class="error-message">
                            ${kcSanitize(messagesPerField.get('password'))?no_esc}
                        </span>
                    </#if>
                </div>
            </div>

            <!-- Confirm Password -->
            <div class="${properties.kcFormGroupClass!}">
                <div class="${properties.kcLabelWrapperClass!}">
                    <label for="password-confirm" class="${properties.kcLabelClass!}">
                        ${msg("passwordConfirm")} <span class="required">*</span>
                    </label>
                </div>
                <div class="${properties.kcInputWrapperClass!}">
                    <input type="password" id="password-confirm" class="${properties.kcInputClass!}"
                           name="password-confirm"
                           aria-invalid="<#if messagesPerField.existsError('password-confirm')>true</#if>"
                           required />

                    <#if messagesPerField.existsError('password-confirm')>
                        <span class="error-message">
                            ${kcSanitize(messagesPerField.get('password-confirm'))?no_esc}
                        </span>
                    </#if>
                </div>
            </div>

            <!-- Terms and Conditions -->
            <div class="${properties.kcFormGroupClass!}">
                <div class="checkbox">
                    <label>
                        <input type="checkbox" id="user.attributes.termsAccepted" 
                               name="user.attributes.termsAccepted" 
                               value="true"
                               required />
                        I accept the <a href="/terms" target="_blank">Terms and Conditions</a> <span class="required">*</span>
                    </label>
                </div>
            </div>

            <#if recaptchaRequired??>
            <div class="form-group">
                <div class="${properties.kcInputWrapperClass!}">
                    <div class="g-recaptcha" data-size="compact" data-sitekey="${recaptchaSiteKey}"></div>
                </div>
            </div>
            </#if>

            <div class="${properties.kcFormGroupClass!}">
                <div id="kc-form-buttons" class="${properties.kcFormButtonsClass!}">
                    <input class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}" type="submit" value="${msg("doRegister")}"/>
                </div>
            </div>

            <div id="kc-registration">
                <span>${msg("alreadyHaveAccount")} <a href="${url.loginUrl}">${msg("doLogIn")}</a></span>
            </div>
        </form>

        <script>
            function togglePaymentFields(paymentType) {
                var mobileFields = document.getElementById('mobileMoneyFields');
                var bankFields = document.getElementById('bankFields');
                
                if (paymentType === 'MOBILE_MONEY') {
                    mobileFields.style.display = 'block';
                    bankFields.style.display = 'none';
                    // Make mobile fields required
                    document.getElementById('user.attributes.mobileProvider').setAttribute('required', 'required');
                    document.getElementById('user.attributes.mobileNumber').setAttribute('required', 'required');
                    // Remove bank fields required
                    document.getElementById('user.attributes.bankName').removeAttribute('required');
                    document.getElementById('user.attributes.bankAccountNumber').removeAttribute('required');
                } else if (paymentType === 'BANK_ACCOUNT') {
                    mobileFields.style.display = 'none';
                    bankFields.style.display = 'block';
                    // Remove mobile fields required
                    document.getElementById('user.attributes.mobileProvider').removeAttribute('required');
                    document.getElementById('user.attributes.mobileNumber').removeAttribute('required');
                    // Make bank fields required
                    document.getElementById('user.attributes.bankName').setAttribute('required', 'required');
                    document.getElementById('user.attributes.bankAccountNumber').setAttribute('required', 'required');
                } else {
                    mobileFields.style.display = 'none';
                    bankFields.style.display = 'none';
                }
            }

            // Initialize on page load
            document.addEventListener('DOMContentLoaded', function() {
                var paymentType = document.getElementById('user.attributes.paymentType').value;
                if (paymentType) {
                    togglePaymentFields(paymentType);
                }
            });
        </script>
    </#if>
</@layout.registrationLayout>
