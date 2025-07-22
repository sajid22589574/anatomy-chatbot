document.addEventListener('DOMContentLoaded', () => {
    const controlPanel = document.querySelector('.control-panel');
    const openPanelBtn = document.getElementById('open-panel-btn');
    const closePanelBtn = document.getElementById('close-panel-btn');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const fontIncBtn = document.getElementById('font-size-increase-btn');
    const fontDecBtn = document.getElementById('font-size-decrease-btn');
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    const topicCardsContainer = document.getElementById('topic-cards-container');
    const favoritesList = document.getElementById('favorites-list');
    const chatWindow = document.getElementById('chat-window');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    
    let currentFontSize = 16;
    const favorites = JSON.parse(localStorage.getItem('anatomyFavorites')) || [];

    const topics = {
        "Upper Limb & Thorax": [
            { name: 'Bones of Upper Limb', icon: 'fa-bone' },
            { name: 'Pectoral Region', icon: 'fa-male' },
            { name: 'Scapular Region', icon: 'fa-male' },
            { name: 'Axilla', icon: 'fa-male' },
            { name: 'Arm', icon: 'fa-male' },
            { name: 'Forearm and Hand', icon: 'fa-hand-paper' },
            { name: 'Joints of Upper Limb', icon: 'fa-joint' },
            { name: 'Wall of Thorax', icon: 'fa-male' },
            { name: 'Thoracic Cavity', icon: 'fa-male' },
        ],
        "Abdomen & Lower Limb": [
            { name: 'Anterior Abdominal Wall', icon: 'fa-male' },
            { name: 'Abdominal Cavity', icon: 'fa-male' },
            { name: 'Pelvis', icon: 'fa-male' },
            { name: 'Perineum', icon: 'fa-male' },
            { name: 'Bones of Lower Limb', icon: 'fa-bone' },
            { name: 'Thigh', icon: 'fa-male' },
            { name: 'Leg and Foot', icon: 'fa-shoe-prints' },
            { name: 'Joints of Lower Limb', icon: 'fa-joint' },
        ],
        "Head, Neck & Brain": [
            { name: 'Head and Neck', icon: 'fa-male' },
            { name: 'Cranial Nerves', icon: 'fa-brain' },
            { name: 'Brain', icon: 'fa-brain' },
            { name: 'Eyeball', icon: 'fa-eye' },
            { name: 'Ear', icon: 'fa-ear-listen' },
        ]
    };

    const topicSearch = document.getElementById('topic-search');

    function displayTopics(filter = '') {
        const normalizedFilter = filter.toLowerCase();
        topicCardsContainer.innerHTML = '';
        for (const category in topics) {
            const filteredTopics = topics[category].filter(topic => topic.name.toLowerCase().includes(normalizedFilter));
            if (filteredTopics.length > 0) {
                const categoryDiv = document.createElement('div');
                categoryDiv.className = 'topic-category';
                categoryDiv.innerHTML = `<h3>${category}</h3>`;
                const cardsDiv = document.createElement('div');
                cardsDiv.className = 'topic-cards';
                filteredTopics.forEach(topic => {
                    const card = document.createElement('div');
                    card.className = 'topic-card';
                    card.innerHTML = `
                        <i class="fas ${topic.icon}"></i>
                        <h4>${topic.name}</h4>
                        <button class="favorite-btn" data-topic="${topic.name}" aria-label="Add to favorites">
                            <i class="far fa-star"></i>
                        </button>
                    `;
                    card.addEventListener('click', () => selectTopic(topic.name));
                    cardsDiv.appendChild(card);
                });
                categoryDiv.appendChild(cardsDiv);
                topicCardsContainer.appendChild(categoryDiv);
            }
        }
        updateAllStarIcons();
    }

    topicSearch.addEventListener('input', (e) => {
        displayTopics(e.target.value);
    });

    function selectTopic(topicName) {
        addMessage(topicName, 'user');
        getBotResponse(topicName);
    }

    // --- Chat Functionality ---
    let chatHistory = [];

    function addMessage(text, sender) {
        const messageElem = document.createElement('div');
        messageElem.className = `message ${sender}-message`;
        messageElem.innerHTML = `<p>${text}</p>`;
        chatWindow.appendChild(messageElem);
        chatWindow.scrollTop = chatWindow.scrollHeight;
        if (sender !== 'bot-initial') {
            chatHistory.push({ text, sender });
            saveChatHistory();
        }
    }

    function saveChatHistory() {
        localStorage.setItem('anatomyChatHistory', JSON.stringify(chatHistory));
    }

    function loadChatHistory() {
        const savedHistory = localStorage.getItem('anatomyChatHistory');
        if (savedHistory) {
            chatHistory = JSON.parse(savedHistory);
            chatWindow.innerHTML = '';
            chatHistory.forEach(message => {
                const messageElem = document.createElement('div');
                messageElem.className = `message ${message.sender}-message`;
                messageElem.innerHTML = `<p>${message.text}</p>`;
                chatWindow.appendChild(messageElem);
            });
            chatWindow.scrollTop = chatWindow.scrollHeight;
        } else {
            addMessage("Hello! I'm your anatomy assistant. Select a topic from the control panel or ask me a question.", 'bot-initial');
        }
    }

    function clearChatHistory() {
        chatHistory = [];
        localStorage.removeItem('anatomyChatHistory');
        chatWindow.innerHTML = '';
        addMessage("Hello! I'm your anatomy assistant. Select a topic from the control panel or ask me a question.", 'bot-initial');
    }

    clearHistoryBtn.addEventListener('click', clearChatHistory);

    function handleUserInput() {
        const text = userInput.value.trim();
        if (text) {
            addMessage(text, 'user');
            userInput.value = '';
            getBotResponse(text);
        }
    }

    async function getBotResponse(question) {
        showTypingIndicator();
        let botMessageElem = null; // To hold the bot's message element

        try {
            const response = await fetch('/ask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ question: question }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            hideTypingIndicator();
            
            // Create a new message element for the bot's response
            botMessageElem = document.createElement('div');
            botMessageElem.className = 'message bot-message';
            const p = document.createElement('p');
            botMessageElem.appendChild(p);
            chatWindow.appendChild(botMessageElem);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                fullResponse += chunk;
                p.innerHTML = fullResponse; // Use innerHTML to render <br> tags
                chatWindow.scrollTop = chatWindow.scrollHeight;
            }

        } catch (error) {
            hideTypingIndicator();
            console.error('Error fetching bot response:', error);
            if (botMessageElem) {
                botMessageElem.querySelector('p').textContent = 'Sorry, I encountered an error. Please try again.';
            } else {
                addMessage('Sorry, I encountered an error. Please try again.', 'bot');
            }
        }
    }

    function showTypingIndicator() {
        const typingElem = document.createElement('div');
        typingElem.className = 'message bot-message typing-indicator';
        typingElem.innerHTML = `
            <span></span>
            <span></span>
            <span></span>
        `;
        chatWindow.appendChild(typingElem);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    function hideTypingIndicator() {
        const typingElem = document.querySelector('.typing-indicator');
        if (typingElem) {
            typingElem.remove();
        }
    }

    sendBtn.addEventListener('click', handleUserInput);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleUserInput();
        }
    });

    // --- Personalization & Accessibility ---
    function toggleTheme() {
        document.body.classList.toggle('light-mode');
        document.body.classList.toggle('dark-mode');
        const isLight = document.body.classList.contains('light-mode');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        themeToggleBtn.innerHTML = isLight ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    }

    function changeFontSize(amount) {
        currentFontSize = Math.max(10, Math.min(22, currentFontSize + amount));
        document.documentElement.style.setProperty('--font-size-base', `${currentFontSize}px`);
        localStorage.setItem('fontSize', currentFontSize);
    }

    function toggleFavorite(topicName, starIcon) {
        const index = favorites.indexOf(topicName);
        if (index > -1) {
            favorites.splice(index, 1);
            starIcon.classList.remove('fas');
            starIcon.classList.add('far');
        } else {
            favorites.push(topicName);
            starIcon.classList.remove('far');
            starIcon.classList.add('fas');
        }
        localStorage.setItem('anatomyFavorites', JSON.stringify(favorites));
        displayFavorites();
        updateAllStarIcons();
    }

    function displayFavorites() {
        favoritesList.innerHTML = '';
        favorites.forEach(topicName => {
            const li = document.createElement('li');
            li.textContent = topicName;
            li.addEventListener('click', () => selectTopic(topicName));
            favoritesList.appendChild(li);
        });
    }

    function updateAllStarIcons() {
        document.querySelectorAll('.favorite-btn').forEach(btn => {
            const topicName = btn.dataset.topic;
            const starIcon = btn.querySelector('i');
            if (favorites.includes(topicName)) {
                starIcon.classList.remove('far');
                starIcon.classList.add('fas');
            } else {
                starIcon.classList.remove('fas');
                starIcon.classList.add('far');
            }
        });
    }

    function loadPreferences() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            toggleTheme();
        }

        const savedFontSize = localStorage.getItem('fontSize');
        if (savedFontSize) {
            currentFontSize = parseInt(savedFontSize, 10);
            changeFontSize(0);
        }
        
        displayFavorites();
    }

    themeToggleBtn.addEventListener('click', toggleTheme);
    fontIncBtn.addEventListener('click', () => changeFontSize(1));
    fontDecBtn.addEventListener('click', () => changeFontSize(-1));
    openPanelBtn.addEventListener('click', () => {
        controlPanel.classList.remove('hidden');
    });

    closePanelBtn.addEventListener('click', () => {
        controlPanel.classList.add('hidden');
    });

    // --- Initialization ---
    displayTopics();
    loadChatHistory();
    loadPreferences();
    updateAllStarIcons();
});
