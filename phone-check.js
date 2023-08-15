const phoneNumberColumns = ['TELEFONE_1', 'TELEFONE_2', 'TELEFONE_3', 'TELEFONE_4'];

function calculateAge(birthday) {
    let today = new Date();
    let birthDate = new Date(birthday);
    let age = today.getFullYear() - birthDate.getFullYear();
    let month = today.getMonth() - birthDate.getMonth();

    if (month < 0 || (month === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    return age;
}

function isMemberJb(age) {
    if (age < 18) {
        return true;
    }
    return false;
}


function checkPhoneNumber(df, inputPhoneNumber) {

    // Validation to check if all columns exist in df
    if(!phoneNumberColumns.every(col => df.columns.includes(col))) {
        throw new Error("Some or all phoneNumberColumns do not exist in the dataframe.");
    }

    // Validation to check if the dataframe has less than 1500 rows
    if(df.shape[0] < 4) {
        throw new Error("The dataframe has less than 4 rows.");
    }

    for (let i = 0; i < df.shape[0]; i++) {

        let birthday = df.at(i, 'DATA DE NASCIMENTO');
        let age = calculateAge(birthday);

        for (let column of phoneNumberColumns) {
            let phoneNumber = df.at(i, column);

            // Check if phone number is present in the current column
            if (!phoneNumber) continue;

            // Check if the phone number is international
            if (phoneNumber.includes('+')) {
                // Remove any non-numeric characters
                phoneNumber = phoneNumber.replace(/\D/g, '');
            } else {
                // If the number doesn't contain a '+', assume it's Brazilian (55)
                phoneNumber = '55' + phoneNumber.replace(/\D/g, '');
            }

            let status = df.at(i, 'STATUS');

            // If it's a Brazilian number, try with and without the ninth digit (which is actually the fifth digit in this case)
            if (phoneNumber.startsWith('55')) {
                if (phoneNumber.length === 13) {
                    // If it has 13 digits, it includes the ninth digit. Let's try without it too
                    let numberWithoutNinthDigit = phoneNumber.slice(0, 4) + phoneNumber.slice(5);
                    if (phoneNumber === inputPhoneNumber || numberWithoutNinthDigit === inputPhoneNumber) {
                      
                        return {found: true, status: status, mb: df.at(i, 'N_DE_CADASTRO'), isMemberJb: isMemberJb(age)};

                    }
                } else if (phoneNumber.length === 12) {
                    // If it has 12 digits, it doesn't include the ninth digit. Let's try with it too
                    let numberWithNinthDigit = phoneNumber.slice(0, 4) + '9' + phoneNumber.slice(4);
                    if (phoneNumber === inputPhoneNumber || numberWithNinthDigit === inputPhoneNumber) {

                        return {found: true, status: status, mb: df.at(i, 'N_DE_CADASTRO'), isMemberJb: isMemberJb(age)};

                    }
                }
            } else {
                if (phoneNumber === inputPhoneNumber) {

                    return {found: true, status: status, mb: df.at(i, 'N_DE_CADASTRO'), isMemberJb: isMemberJb(age)};
                }
            }
        }
    }
    return {found: false};
}

module.exports = checkPhoneNumber;
