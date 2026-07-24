@echo off
rem 设置/修改学习模式管理密码（解除封锁时需要输入）
powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0study-mode-setpass.ps1\"'"
