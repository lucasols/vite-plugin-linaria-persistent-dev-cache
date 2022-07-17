if [[ `git status --porcelain` ]]; then
  echo "Commit you changes before publish"
  exit 1
else
  exit 0
fi
