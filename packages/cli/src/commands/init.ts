/**
 * simi init - Create a new Simi project
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

export const initCommand = new Command('init')
  .description('Create a new Simi chatbot project')
  .argument('[name]', 'Project name', 'simi-chatbot')
  .option('-t, --template <type>', 'Project template', 'default')
  .option('-l, --lang <lang>', 'Default language (ko/en)', 'ko')
  .option('--no-git', 'Skip git initialization')
  .action(async (name: string, options) => {
    const chalk = (await import('chalk')).default;
    const ora = (await import('ora')).default;

    console.log();
    console.log(chalk.cyan.bold('🎭 Simi - AI Character Chatbot'));
    console.log();

    const spinner = ora('Creating project...').start();

    try {
      const projectPath = path.resolve(process.cwd(), name);

      // Check if directory exists
      if (fs.existsSync(projectPath)) {
        spinner.fail(chalk.red(`Directory "${name}" already exists`));
        process.exit(1);
      }

      // Create directory structure
      fs.mkdirSync(projectPath, { recursive: true });
      fs.mkdirSync(path.join(projectPath, 'data', 'patterns'), { recursive: true });
      fs.mkdirSync(path.join(projectPath, 'data', 'responses'), { recursive: true });
      fs.mkdirSync(path.join(projectPath, 'models'), { recursive: true });
      fs.mkdirSync(path.join(projectPath, 'public'), { recursive: true });

      // Create package.json
      const packageJson = {
        name,
        version: '1.0.0',
        description: 'Simi AI Chatbot Project',
        main: 'index.js',
        scripts: {
          dev: 'simi serve',
          train: 'simi train',
          chat: 'simi chat',
          build: 'simi export',
        },
        dependencies: {
          '@simi/core': '^1.0.0',
          '@simi/chat': '^1.0.0',
        },
        devDependencies: {
          '@simi/cli': '^1.0.0',
        },
      };

      fs.writeFileSync(
        path.join(projectPath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Create simi.config.json
      const config = {
        name: 'Simi',
        language: options.lang,
        character: {
          name: options.lang === 'ko' ? '심이' : 'Simi',
          personality: 'friendly',
        },
        training: {
          epochs: 10,
          learningRate: 0.01,
        },
        server: {
          port: 3000,
        },
      };

      fs.writeFileSync(
        path.join(projectPath, 'simi.config.json'),
        JSON.stringify(config, null, 2)
      );

      // Create default patterns
      const defaultPatterns = {
        version: '1.0.0',
        language: options.lang,
        patterns: [
          {
            id: 'greeting',
            triggers: options.lang === 'ko'
              ? ['안녕', '하이', '헬로']
              : ['hello', 'hi', 'hey'],
            responses: options.lang === 'ko'
              ? ['안녕하세요!', '반가워요!']
              : ['Hello!', 'Hi there!'],
            intent: 'greeting',
            emotion: 'happy',
          },
          {
            id: 'farewell',
            triggers: options.lang === 'ko'
              ? ['잘가', '바이', '안녕히']
              : ['bye', 'goodbye', 'see you'],
            responses: options.lang === 'ko'
              ? ['다음에 또 봐요!', '잘가요~']
              : ['Goodbye!', 'See you!'],
            intent: 'farewell',
            emotion: 'loving',
          },
        ],
      };

      fs.writeFileSync(
        path.join(projectPath, 'data', 'patterns', `patterns_${options.lang}.json`),
        JSON.stringify(defaultPatterns, null, 2)
      );

      // Create index.html for web UI
      const indexHtml = `<!DOCTYPE html>
<html lang="${options.lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.character.name} - AI Chatbot</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      color: #fff;
    }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    h1 { text-align: center; margin: 20px 0; }
    #chat {
      background: rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 20px;
      height: 400px;
      overflow-y: auto;
      margin-bottom: 20px;
    }
    .message {
      padding: 10px 15px;
      margin: 10px 0;
      border-radius: 16px;
      max-width: 80%;
    }
    .user {
      background: #4a69bd;
      margin-left: auto;
      text-align: right;
    }
    .assistant {
      background: #6ab04c;
    }
    #input-area { display: flex; gap: 10px; }
    #input {
      flex: 1;
      padding: 15px;
      border: none;
      border-radius: 25px;
      background: rgba(255,255,255,0.1);
      color: #fff;
      font-size: 16px;
    }
    #send {
      padding: 15px 30px;
      border: none;
      border-radius: 25px;
      background: #4a69bd;
      color: #fff;
      cursor: pointer;
      font-size: 16px;
    }
    #send:hover { background: #5a79cd; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎭 ${config.character.name}</h1>
    <div id="chat"></div>
    <div id="input-area">
      <input type="text" id="input" placeholder="${options.lang === 'ko' ? '메시지를 입력하세요...' : 'Type a message...'}">
      <button id="send">${options.lang === 'ko' ? '전송' : 'Send'}</button>
    </div>
  </div>
  <script>
    const chat = document.getElementById('chat');
    const input = document.getElementById('input');
    const send = document.getElementById('send');

    function addMessage(text, isUser) {
      const div = document.createElement('div');
      div.className = 'message ' + (isUser ? 'user' : 'assistant');
      div.textContent = text;
      chat.appendChild(div);
      chat.scrollTop = chat.scrollHeight;
    }

    async function sendMessage() {
      const text = input.value.trim();
      if (!text) return;

      addMessage(text, true);
      input.value = '';

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text })
        });
        const data = await res.json();
        addMessage(data.response, false);
      } catch (e) {
        addMessage('Error: Could not connect to server', false);
      }
    }

    send.onclick = sendMessage;
    input.onkeypress = (e) => e.key === 'Enter' && sendMessage();

    addMessage('${options.lang === 'ko' ? '안녕하세요! 심이예요~' : 'Hello! I\\'m Simi~'}', false);
  </script>
</body>
</html>`;

      fs.writeFileSync(path.join(projectPath, 'public', 'index.html'), indexHtml);

      // Create README.md
      const readme = `# ${name}

AI Character Chatbot powered by Simi Platform.

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start interactive chat
npm run chat

# Train the model
npm run train
\`\`\`

## Project Structure

\`\`\`
${name}/
├── data/
│   ├── patterns/     # Pattern definitions
│   └── responses/    # Response templates
├── models/           # Trained models
├── public/           # Web UI
├── simi.config.json  # Configuration
└── package.json
\`\`\`

## License

MIT
`;

      fs.writeFileSync(path.join(projectPath, 'README.md'), readme);

      // Initialize git
      if (options.git !== false) {
        const gitignore = `node_modules/
dist/
.env
*.log
models/*.bin
`;
        fs.writeFileSync(path.join(projectPath, '.gitignore'), gitignore);
      }

      spinner.succeed(chalk.green(`Project "${name}" created successfully!`));

      console.log();
      console.log(chalk.cyan('Next steps:'));
      console.log();
      console.log(chalk.white(`  cd ${name}`));
      console.log(chalk.white('  npm install'));
      console.log(chalk.white('  npm run dev'));
      console.log();
      console.log(chalk.gray('For more info, run: simi --help'));
      console.log();

    } catch (error) {
      spinner.fail(chalk.red('Failed to create project'));
      console.error(error);
      process.exit(1);
    }
  });
