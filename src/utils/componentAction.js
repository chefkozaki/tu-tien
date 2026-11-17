async function runComponentAction(interaction, action, onError, context) {
  try {
    await interaction.deferUpdate();
  } catch (error) {
    console.error(`Không thể xác nhận interaction (${context}):`, error);
    return false;
  }

  try {
    const payload = await action();
    await interaction.editReply(payload);
    return true;
  } catch (error) {
    console.error(`Lỗi xử lý interaction (${context}):`, error);
    if (!onError) return false;

    try {
      await interaction.editReply(onError(error));
    } catch (replyError) {
      console.error(`Không thể gửi thông báo lỗi interaction (${context}):`, replyError);
    }
    return false;
  }
}

function onComponentCollect(collector, handler, context = 'component') {
  let isProcessing = false;
  collector.on('collect', interaction => {
    if (isProcessing) {
      interaction.reply({
        content: 'Thao tác trước vẫn đang được xử lý, vui lòng chờ.',
        ephemeral: true
      }).catch(error => {
        console.error(`Không thể phản hồi interaction trùng (${context}):`, error);
      });
      return;
    }

    isProcessing = true;
    Promise.resolve()
      .then(() => handler(interaction))
      .catch(async error => {
        console.error(`Lỗi không được xử lý trong interaction (${context}):`, error);
        const payload = {
          content: 'Không thể xử lý thao tác này lúc này. Vui lòng thử lại.',
          ephemeral: true
        };
        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(payload);
          } else {
            await interaction.reply(payload);
          }
        } catch (replyError) {
          console.error(`Không thể gửi thông báo lỗi interaction (${context}):`, replyError);
        }
      })
      .finally(() => {
        isProcessing = false;
      });
  });
}

module.exports = { onComponentCollect, runComponentAction };
