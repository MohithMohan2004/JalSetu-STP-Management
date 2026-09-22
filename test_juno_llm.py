from chatbot.llm.gateway import JunoLLMGateway


gateway = JunoLLMGateway()


questions = [
    "what is the nearest stp for koramangala",
    "which treatment plant is closest to kudlu gate",
    "bro can any plant give me 50 kld near hebbal",
    "what is my latest order",
    "where is my tanker",
    "hw many ordres hav i plced",
]


for question in questions:
    print("\n" + "=" * 60)
    print("QUESTION:")
    print(question)

    try:
        result = gateway.understand(question)

        print("\nJUNO STRUCTURED OUTPUT:")
        print(result)

    except Exception as exc:
        print("\nERROR:")
        print(type(exc).__name__)
        print(exc)