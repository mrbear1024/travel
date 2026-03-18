function buildLocationExtractionPrompt(planMarkdown) {
  return `你是一位地理信息专家。请从以下旅行计划中提取所有涉及的地点信息，包括城市、景点、餐厅、酒店等。

## 旅行计划
${planMarkdown.substring(0, 6000)}

## 输出要求
请以 JSON 数组格式输出所有地点，每个地点包含以下字段：

- \`name\`: 地点名称（中文）
- \`type\`: 类型，必须是以下之一：city（城市）、scenic（景点）、food（餐饮）、hotel（住宿）、transport（交通站点）
- \`lat\`: 纬度（数字，尽量精确到小数点后4位）
- \`lng\`: 经度（数字，尽量精确到小数点后4位）
- \`day\`: 第几天到达（数字，如果是整个行程涉及的城市则为 0）
- \`description\`: 简短描述（10-20字）
- \`icon\`: 推荐的 emoji 图标

## 示例输出
\`\`\`json
[
  {
    "name": "杭州西湖",
    "type": "scenic",
    "lat": 30.2590,
    "lng": 120.1388,
    "day": 1,
    "description": "世界文化遗产，十大名湖之首",
    "icon": "🏞️"
  },
  {
    "name": "厦门",
    "type": "city",
    "lat": 24.4798,
    "lng": 118.0894,
    "day": 3,
    "description": "海上花园城市",
    "icon": "🏙️"
  }
]
\`\`\`

## 注意
- 坐标必须真实准确
- 每个城市提取一个 city 类型的点
- 重要景点、推荐餐厅、推荐住宿都要提取
- 按行程日期顺序排列
- 只输出 JSON 数组，不要有其他文字`;
}

module.exports = { buildLocationExtractionPrompt };
