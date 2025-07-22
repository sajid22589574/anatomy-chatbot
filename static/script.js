document.addEventListener('DOMContentLoaded', () => {
    const topics = [
        { name: 'Skeletal System', icon: 'fa-bone', description: 'The framework of the body.' },
        { name: 'Digestive System', icon: 'fa-stomach', description: 'Processes food and absorbs nutrients.' },
        { name: 'Nervous System', icon: 'fa-brain', description: 'Transmits nerve impulses.' },
        { name: 'Cardiovascular System', icon: 'fa-heartbeat', description: 'Circulates blood.' },
        { name: 'Respiratory System', icon: 'fa-lungs', description: 'Manages breathing.' },
        { name: 'Muscular System', icon: 'fa-dumbbell', description: 'Enables movement.' },
        { name: 'Endocrine System', icon: 'fa-dna', description: 'Produces hormones.' },
        { name: 'Reproductive System', icon: 'fa-venus-mars', description: 'Organs for reproduction.' },
        { name: 'Integumentary System', icon: 'fa-tshirt', description: 'Skin, hair, and nails.' },
        { name: 'Lymphatic System', icon: 'fa-shield-alt', description: 'Part of the immune system.' },
        { name: 'Urinary System', icon: 'fa-toilet', description: 'Produces and excretes urine.' }
    ];

    const topicCardsContainer = document.getElementById('topic-cards-container');
    const chatWindow = document.getElementById('chat-window');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const fontIncBtn = document.getElementById('font-size-increase-btn');
    const fontDecBtn = document.getElementById('font-size-decrease-btn');
    const favoritesList = document.getElementById('favorites-list');
    const openPanelBtn = document.getElementById('open-panel-btn'); // Renamed from panelToggleBtn
    const closePanelBtn = document.getElementById('close-panel-btn'); // New close button
    const controlPanel = document.querySelector('.control-panel');

    let currentFontSize = 14;
    let favorites = JSON.parse(localStorage.getItem('anatomyFavorites')) || [];

    // --- Topic Management ---
    function getRandomTopics(count) {
        const shuffled = [...topics].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    function displayTopics() {
        const selectedTopics = getRandomTopics(3);
        topicCardsContainer.innerHTML = '';
        selectedTopics.forEach(topic => {
            const card = document.createElement('div');
            card.className = 'topic-card';
            card.innerHTML = `
                <i class="fas ${topic.icon}"></i>
                <h3>${topic.name}</h3>
                <button class="favorite-btn" data-topic="${topic.name}" aria-label="Add to favorites">
                    <i class="far fa-star"></i>
                </button>
            `;
            card.addEventListener('click', () => selectTopic(topic.name));
            topicCardsContainer.appendChild(card);
        });
        
        document.querySelectorAll('.favorite-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent card click event from firing
                toggleFavorite(btn.dataset.topic, btn.querySelector('i'));
            });
        });
    }

    function selectTopic(topicName) {
        addMessage(topicName, 'user');
        getBotResponse(topicName);
    }

    // --- Chat Functionality ---
    function addMessage(text, sender) {
        const messageElem = document.createElement('div');
        messageElem.className = `message ${sender}-message`;
        messageElem.innerHTML = `<p>${text}</p>`;
        chatWindow.appendChild(messageElem);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

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
        controlPanel.classList.add('hidden'); // Hide panel
    });

    // --- Initialization ---
    displayTopics();
    setInterval(displayTopics, 30000); // Refresh topics every 30 seconds
    loadPreferences();
    updateAllStarIcons();
});
