/* =========================================================
   WASTEWATER ASSISTANT CHATBOT
   Uses the Flask session + /api/chat backend.
========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    const toggle = document.getElementById("ww-chatbot-toggle");
    const windowElement = document.getElementById("ww-chatbot-window");
    const close = document.getElementById("ww-chatbot-close");
    const input = document.getElementById("ww-chatbot-input");
    const send = document.getElementById("ww-chatbot-send");
    const messages = document.getElementById("ww-chatbot-messages");
    const typing = document.getElementById("ww-chatbot-typing");

    if (
        !toggle ||
        !windowElement ||
        !close ||
        !input ||
        !send ||
        !messages ||
        !typing
    ) {
        console.error(
            "Wastewater chatbot: required HTML elements are missing."
        );
        return;
    }

    // ---------------------------------------------------------
    // BROWSER LOCATION
    // ---------------------------------------------------------

    window.chatbotLatitude = null;
    window.chatbotLongitude = null;

    function requestChatbotLocation() {

        if (!navigator.geolocation) {
            console.log(
                "Geolocation is not supported by this browser."
            );
            return;
        }

        navigator.geolocation.getCurrentPosition(
            function (position) {

                window.chatbotLatitude =
                    position.coords.latitude;

                window.chatbotLongitude =
                    position.coords.longitude;

                console.log(
                    "Chatbot location:",
                    window.chatbotLatitude,
                    window.chatbotLongitude
                );

            },
            function (error) {

                console.log(
                    "Chatbot location unavailable:",
                    error.message
                );

            },
            {
                enableHighAccuracy: false,
                timeout: 8000,
                maximumAge: 300000
            }
        );
    }

    requestChatbotLocation();

    // ---------------------------------------------------------
    // OPEN / CLOSE CHATBOT
    // ---------------------------------------------------------

    toggle.addEventListener("click", function () {

        windowElement.classList.remove(
            "ww-chatbot-hidden"
        );

        input.focus();

        // Try requesting location again when chatbot is opened.
        if (
            window.chatbotLatitude === null ||
            window.chatbotLongitude === null
        ) {
            requestChatbotLocation();
        }

    });

    close.addEventListener("click", function () {

        windowElement.classList.add(
            "ww-chatbot-hidden"
        );

    });

    // ---------------------------------------------------------
    // ADD MESSAGE
    // ---------------------------------------------------------

    function addMessage(message, sender) {

        const wrapper =
            document.createElement("div");

        wrapper.classList.add(
            "ww-chat-message"
        );

        if (sender === "user") {

            wrapper.classList.add(
                "ww-chat-user"
            );

        } else {

            wrapper.classList.add(
                "ww-chat-bot"
            );

        }

        const bubble =
            document.createElement("div");

        bubble.classList.add(
            "ww-chat-bubble"
        );

        /*
         * Use textContent instead of innerHTML.
         *
         * This keeps chatbot responses safe and prevents
         * HTML/JavaScript injection through chatbot replies.
         */
        bubble.textContent =
            String(message);

        wrapper.appendChild(
            bubble
        );

        messages.appendChild(
            wrapper
        );

        messages.scrollTop =
            messages.scrollHeight;
    }

    // ---------------------------------------------------------
    // SEND MESSAGE
    // ---------------------------------------------------------

    async function sendMessage() {

        const message =
            input.value.trim();

        if (!message) {
            return;
        }

        // Display user's message immediately.
        addMessage(
            message,
            "user"
        );

        // Clear input.
        input.value = "";

        // Prevent duplicate requests while processing.
        input.disabled = true;
        send.disabled = true;

        // Show typing indicator.
        typing.classList.remove(
            "ww-chatbot-typing-hidden"
        );

        try {

            const response =
                await fetch(
                    "/api/chat",
                    {
                        method: "POST",

                        /*
                         * IMPORTANT:
                         * Send the Flask session cookie.
                         * This allows the backend to identify
                         * the logged-in buyer.
                         */
                        credentials: "same-origin",

                        headers: {
                            "Content-Type":
                                "application/json",

                            "Accept":
                                "application/json"
                        },

                        body: JSON.stringify({

                            message:
                                message,

                            latitude:
                                window.chatbotLatitude,

                            longitude:
                                window.chatbotLongitude

                        })
                    }
                );

            /*
             * Flask should normally return JSON.
             *
             * If the server returns an HTML error page,
             * this prevents JSON parsing from hiding the
             * actual problem.
             */
            const contentType =
                response.headers.get(
                    "content-type"
                ) || "";

            if (
                !contentType.includes(
                    "application/json"
                )
            ) {

                const rawText =
                    await response.text();

                console.error(
                    "Chatbot returned non-JSON response:",
                    response.status,
                    rawText
                );

                throw new Error(
                    "Server returned a non-JSON response."
                );
            }

            const data =
                await response.json();

            // -------------------------------------------------
            // SUCCESSFUL CHATBOT RESPONSE
            // -------------------------------------------------

            if (
                data &&
                data.reply
            ) {

                addMessage(
                    data.reply,
                    "bot"
                );

            }

            // -------------------------------------------------
            // ERROR SENT BY BACKEND
            // -------------------------------------------------

            else if (
                data &&
                data.error
            ) {

                addMessage(
                    data.error,
                    "bot"
                );

            }

            // -------------------------------------------------
            // EMPTY RESPONSE
            // -------------------------------------------------

            else {

                addMessage(
                    "I couldn't understand that request.",
                    "bot"
                );

            }

        }

        catch (error) {

            console.error(
                "Chatbot request failed:",
                error
            );

            addMessage(
                "Sorry, I couldn't process that request. Please try again.",
                "bot"
            );

        }

        finally {

            // Hide typing indicator.
            typing.classList.add(
                "ww-chatbot-typing-hidden"
            );

            // Re-enable input.
            input.disabled = false;
            send.disabled = false;

            input.focus();
        }
    }

    // ---------------------------------------------------------
    // SEND BUTTON
    // ---------------------------------------------------------

    send.addEventListener(
        "click",
        sendMessage
    );

    // ---------------------------------------------------------
    // ENTER KEY
    // ---------------------------------------------------------

    input.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                if (
                    !input.disabled
                ) {

                    sendMessage();

                }
            }
        }
    );

});