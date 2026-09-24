name: Bug 反馈
about: 报告素刀运行中的问题
title: "[Bug] "
labels: ["bug"]
body:
  - type: markdown
    attributes:
      label: 问题描述
      description: 发生了什么问题，期望的行为是什么
    validations:
      required: true
  - type: input
    attributes:
      label: 版本号
      description: 系统设置 → 关于（例如 2.2.0）
    validations:
      required: true
  - type: textarea
    attributes:
      label: 复现步骤
      description: 操作路径：哪一步出问题
  - type: textarea
    attributes:
      label: 诊断信息
      description: 任务中心 → 导出诊断，把文件内容贴在这里或作为附件上传
  - type: dropdown
    attributes:
      label: 操作系统
      options:
        - Windows 11
        - Windows 10
        - 其他
    validations:
      required: true
