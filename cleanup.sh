#!/bin/bash

# Скрипт очистки временных файлов HSE Portfolio Bot
# Удаляет старые сгенерированные изображения

set -e

echo "🧹 Начинаю очистку временных файлов..."

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Директория с временными файлами
ASSETS_DIR="./assets/generated"

if [ ! -d "$ASSETS_DIR" ]; then
    print_warning "Директория $ASSETS_DIR не найдена"
    exit 0
fi

# Подсчитываем файлы
TOTAL_FILES=$(find "$ASSETS_DIR" -name "*.png" -type f | wc -l)

if [ "$TOTAL_FILES" -eq 0 ]; then
    print_status "Временные файлы не найдены"
    exit 0
fi

print_status "Найдено $TOTAL_FILES временных файлов"

# Удаляем файлы старше 1 часа
DELETED_OLD=$(find "$ASSETS_DIR" -name "*.png" -type f -mmin +60 -delete -print | wc -l)

if [ "$DELETED_OLD" -gt 0 ]; then
    print_status "Удалено $DELETED_OLD старых файлов (старше 1 часа)"
fi

# Удаляем все файлы если их больше 100
REMAINING_FILES=$(find "$ASSETS_DIR" -name "*.png" -type f | wc -l)

if [ "$REMAINING_FILES" -gt 100 ]; then
    print_warning "Слишком много файлов ($REMAINING_FILES), удаляю все"
    find "$ASSETS_DIR" -name "*.png" -type f -delete
    DELETED_ALL=$(($REMAINING_FILES))
    print_status "Удалено $DELETED_ALL файлов"
else
    print_status "Осталось $REMAINING_FILES файлов"
fi

# Показываем размер директории
if [ -d "$ASSETS_DIR" ]; then
    DIR_SIZE=$(du -sh "$ASSETS_DIR" 2>/dev/null | cut -f1)
    print_status "Размер директории: $DIR_SIZE"
fi

echo "✅ Очистка завершена!" 