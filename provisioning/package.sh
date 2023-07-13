rm -r build
mkdir build
# Build dependencies:
cd build
npm i
ls

# Move required application files into build:
cp *.py .
cp -R lib .
cp -R config .
cp -R routes .

zip -qr build.zip *