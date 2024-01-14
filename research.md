---
layout: page
title: "Research"
---

{% for research_topic in site.research_topics %}
  <h2>{{ research_topic.topic }}</h2>
  <p>{{ research_topic.content | markdownify }}</p>
{% endfor %}

