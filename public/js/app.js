const { createApp, ref, computed, nextTick } = Vue;

createApp({
  setup() {
    const step = ref('input');
    const userInput = ref('');
    const isLoading = ref(false);
    const errorMsg = ref('');
    const questions = ref([]);
    const answers = ref({});
    const planMarkdown = ref('');

    const exampleIdeas = [
      '我想带5岁的孩子去三亚玩5天',
      '和朋友去云南大理丽江，7天自由行',
      '一个人去日本东京大阪，预算8000元',
      '带父母去厦门养生度假一周',
      '情侣蜜月旅行，想去海岛',
      '国庆长假全家自驾去西北大环线',
    ];

    // Configure marked
    marked.setOptions({
      breaks: true,
      gfm: true,
    });

    const renderedPlan = computed(() => {
      if (!planMarkdown.value) return '';
      try {
        return marked.parse(planMarkdown.value);
      } catch {
        return planMarkdown.value;
      }
    });

    function showError(msg) {
      errorMsg.value = msg;
      setTimeout(() => { errorMsg.value = ''; }, 4000);
    }

    function formatNumber(num) {
      if (num === undefined || num === null) return '';
      return num.toLocaleString('zh-CN');
    }

    function resetAll() {
      step.value = 'input';
      userInput.value = '';
      questions.value = [];
      answers.value = {};
      planMarkdown.value = '';
      isLoading.value = false;
    }

    async function submitIdea() {
      if (!userInput.value.trim() || isLoading.value) return;

      isLoading.value = true;
      try {
        const res = await fetch('/api/questionnaire', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userInput: userInput.value.trim() }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || '请求失败');
        }

        const data = await res.json();
        questions.value = data.questions;

        // Initialize answers with defaults
        answers.value = {};
        data.questions.forEach((q) => {
          if (q.type === 'checkbox') {
            answers.value[q.id] = [];
          } else if (q.type === 'slider') {
            answers.value[q.id] = Math.round((q.min + q.max) / 2);
          } else if (q.type === 'daterange') {
            answers.value[q.id + '_start'] = '';
            answers.value[q.id + '_end'] = '';
          } else {
            answers.value[q.id] = '';
          }
        });

        step.value = 'questionnaire';
      } catch (e) {
        showError(e.message || '问卷生成失败，请重试');
      } finally {
        isLoading.value = false;
      }
    }

    async function generatePlan() {
      if (isLoading.value) return;

      isLoading.value = true;
      planMarkdown.value = '';
      step.value = 'plan';

      // Format answers with labels
      const formattedAnswers = {};
      questions.value.forEach((q) => {
        if (q.type === 'daterange') {
          const start = answers.value[q.id + '_start'];
          const end = answers.value[q.id + '_end'];
          if (start || end) {
            formattedAnswers[q.label] = `${start || '未定'} 至 ${end || '未定'}`;
          }
        } else if (q.type === 'checkbox') {
          const val = answers.value[q.id];
          if (val && val.length > 0) {
            formattedAnswers[q.label] = val;
          }
        } else if (q.type === 'slider') {
          formattedAnswers[q.label] = `${answers.value[q.id]}`;
        } else {
          const val = answers.value[q.id];
          if (val) {
            formattedAnswers[q.label] = val;
          }
        }
      });

      try {
        const res = await fetch('/api/travel-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userInput: userInput.value.trim(),
            answers: formattedAnswers,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || '请求失败');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'text') {
                planMarkdown.value += data.content;
              } else if (data.type === 'error') {
                showError(data.content);
              } else if (data.type === 'done') {
                // Stream finished
              }
            } catch {
              // skip malformed chunks
            }
          }
        }
      } catch (e) {
        if (e.name !== 'AbortError') {
          showError(e.message || '旅行计划生成失败，请重试');
        }
      } finally {
        isLoading.value = false;
      }
    }

    function printPlan() {
      window.print();
    }

    return {
      step,
      userInput,
      isLoading,
      errorMsg,
      questions,
      answers,
      planMarkdown,
      renderedPlan,
      exampleIdeas,
      submitIdea,
      generatePlan,
      resetAll,
      showError,
      formatNumber,
      printPlan,
    };
  },
}).mount('#app');
