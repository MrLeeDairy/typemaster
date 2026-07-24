@echo off
rem 关闭学习模式：恢复浏览器上网
powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0study-mode-off.ps1\"'"
