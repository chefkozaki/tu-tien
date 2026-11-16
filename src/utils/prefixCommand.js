const { ApplicationCommandOptionType } = require('discord.js');

function tokenize(input) {
  const tokens = [];
  let token = '';
  let quote = null;
  for (const character of input) {
    if (quote) {
      if (character === quote) quote = null;
      else token += character;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (/\s/.test(character)) {
      if (token) {
        tokens.push(token);
        token = '';
      }
    } else {
      token += character;
    }
  }
  if (quote) throw new Error('Dấu ngoặc kép chưa được đóng.');
  if (token) tokens.push(token);
  return tokens;
}

function parseArgumentTokens(tokens, options) {
  const values = new Map();
  const positionalOptions = options.filter(option =>
    option.type !== ApplicationCommandOptionType.Subcommand &&
    option.type !== ApplicationCommandOptionType.SubcommandGroup
  );
  const positional = [];

  for (const token of tokens) {
    const separatorIndex = token.search(/[:=]/);
    if (separatorIndex > 0) {
      const name = token.slice(0, separatorIndex).replace(/^--/, '');
      const option = positionalOptions.find(candidate => candidate.name === name);
      if (option) {
        values.set(name, token.slice(separatorIndex + 1));
        continue;
      }
    }
    positional.push(token);
  }

  for (const option of positionalOptions) {
    if (!values.has(option.name) && positional.length > 0) {
      values.set(option.name, positional.shift());
    }
    if (option.required && !values.has(option.name)) {
      throw new Error(`Thiếu tham số \`${option.name}\`. Dùng cú pháp \`${option.name}:<value>\`.`);
    }
  }
  if (positional.length > 0) {
    throw new Error(`Thừa tham số: ${positional.join(' ')}.`);
  }
  return values;
}

function coerceValue(option, rawValue) {
  if (rawValue === undefined) return null;
  let value;
  if (option.type === ApplicationCommandOptionType.Integer) {
    value = Number(rawValue);
    if (!Number.isInteger(value)) throw new Error(`\`${option.name}\` phải là số nguyên.`);
  } else if (option.type === ApplicationCommandOptionType.Number) {
    value = Number(rawValue);
    if (!Number.isFinite(value)) throw new Error(`\`${option.name}\` phải là số.`);
  } else if (option.type === ApplicationCommandOptionType.Boolean) {
    if (/^(true|yes|1)$/i.test(rawValue)) value = true;
    else if (/^(false|no|0)$/i.test(rawValue)) value = false;
    else throw new Error(`\`${option.name}\` phải là true hoặc false.`);
  } else {
    value = rawValue;
  }

  if (option.choices?.length) {
    const choice = option.choices.find(candidate =>
      candidate.value === value || candidate.name.toLowerCase() === String(rawValue).toLowerCase()
    );
    if (!choice) {
      throw new Error(`Giá trị \`${rawValue}\` không hợp lệ cho \`${option.name}\`.`);
    }
    value = choice.value;
  }
  if (typeof value === 'number' && option.minValue !== undefined && value < option.minValue) {
    throw new Error(`\`${option.name}\` phải lớn hơn hoặc bằng ${option.minValue}.`);
  }
  if (typeof value === 'number' && option.maxValue !== undefined && value > option.maxValue) {
    throw new Error(`\`${option.name}\` phải nhỏ hơn hoặc bằng ${option.maxValue}.`);
  }
  if (typeof value === 'string' && option.minLength !== undefined && value.length < option.minLength) {
    throw new Error(`\`${option.name}\` cần ít nhất ${option.minLength} ký tự.`);
  }
  if (typeof value === 'string' && option.maxLength !== undefined && value.length > option.maxLength) {
    throw new Error(`\`${option.name}\` tối đa ${option.maxLength} ký tự.`);
  }
  return value;
}

async function buildPrefixInteraction(message, command, argumentTokens, prefix) {
  const commandData = command.data.toJSON();
  const commandOptions = commandData.options || [];
  let selectedSubcommand = null;
  let optionDefinitions = commandOptions;

  if (commandOptions[0]?.type === ApplicationCommandOptionType.SubcommandGroup) {
    throw new Error(`Lệnh \`${commandData.name}\` chưa hỗ trợ gọi qua prefix.`);
  }
  if (commandOptions[0]?.type === ApplicationCommandOptionType.Subcommand) {
    const subcommandName = argumentTokens.shift();
    selectedSubcommand = commandOptions.find(option => option.name === subcommandName);
    if (!selectedSubcommand) {
      const available = commandOptions.map(option => option.name).join(', ');
      throw new Error(`Chọn một mục của \`${commandData.name}\`: ${available}.`);
    }
    optionDefinitions = selectedSubcommand.options || [];
  }

  const values = parseArgumentTokens(argumentTokens, optionDefinitions);
  const resolvedValues = new Map();
  for (const option of optionDefinitions) {
    if (!values.has(option.name)) continue;
    const value = coerceValue(option, values.get(option.name));
    if (option.type === ApplicationCommandOptionType.User) {
      const userId = value.match(/^<@!?(\d+)>$/)?.[1] || value;
      if (!/^\d+$/.test(userId)) {
        throw new Error(`\`${option.name}\` cần mention người dùng hoặc Discord user ID.`);
      }
      resolvedValues.set(option.name, await message.client.users.fetch(userId));
    } else {
      resolvedValues.set(option.name, value);
    }
  }

  const getOption = (name, type) => {
    const definition = optionDefinitions.find(option => option.name === name);
    if (!definition || (type && definition.type !== type)) return null;
    return resolvedValues.get(name) ?? null;
  };

  let responseMessage = null;
  const replyToChannel = async payload => {
    const { ephemeral, ...messagePayload } = payload;
    return message.channel.send(messagePayload);
  };

  return {
    user: message.author,
    guild: message.guild,
    guildId: message.guildId,
    channel: message.channel,
    channelId: message.channelId,
    client: message.client,
    options: {
      getSubcommand() {
        if (!selectedSubcommand) throw new Error('This command has no subcommand.');
        return selectedSubcommand.name;
      },
      getString(name) {
        return getOption(name, ApplicationCommandOptionType.String);
      },
      getInteger(name) {
        return getOption(name, ApplicationCommandOptionType.Integer);
      },
      getNumber(name) {
        return getOption(name, ApplicationCommandOptionType.Number);
      },
      getBoolean(name) {
        return getOption(name, ApplicationCommandOptionType.Boolean);
      },
      getUser(name) {
        return getOption(name, ApplicationCommandOptionType.User);
      }
    },
    async reply(payload) {
      responseMessage = await replyToChannel(payload);
      return responseMessage;
    },
    async deferReply() {
      responseMessage = await message.channel.send('Đang xử lý lệnh...');
      return responseMessage;
    },
    async editReply(payload) {
      if (!responseMessage) return this.reply(payload);
      const { ephemeral, ...messagePayload } = payload;
      return responseMessage.edit(messagePayload);
    },
    async followUp(payload) {
      return replyToChannel(payload);
    },
    prefix
  };
}

async function executePrefixCommand(message, command, argumentTokens, prefix) {
  const interaction = await buildPrefixInteraction(message, command, argumentTokens, prefix);
  return command.execute(interaction);
}

module.exports = { executePrefixCommand, tokenize };
