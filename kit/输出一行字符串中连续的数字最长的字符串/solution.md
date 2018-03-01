  public static void main(String[] args){
        try{
            String a = "a12367s23d";
            char[] cc = a.toCharArray();
            Integer temp = null;
            HashMap<String,String> map = new HashMap<String,String>();
            int j = 0;
            for(char s:cc){
                Integer i = null;
                if(Character.isDigit(s)){
                    i = Integer.valueOf(s+"");
                }
                if((temp == null&& i != null)||temp!= null && i != null && temp == i-1){
                    System.out.print(i);
                    if(map.get(""+j) != null){
                        map.put(j+"",map.get(""+j)+i);
                    }else {
                        map.put(j+"",i+"");
                    }
                }else {
                    j++;
                    if(i != null){
                        map.put(j+"",i+"");
                    }
                    System.out.println();
                    if(i != null){
                        map.put(j+"",i+"");
                        System.out.print(i);
                    }
                }
                temp = i;
            }
            int len = 0;
            String maxLenStr = "";
            for (Map.Entry<String, String> entry : map.entrySet()) {
                String value = entry.getValue().toString();
                if(len==0){
                    len = value.length();
                    maxLenStr = value;
                }else {
                    if(value.length()>len){
                        len = value.length();
                        maxLenStr = value;
                    }
                }
            }
            System.out.println("最长连续数字 字符串： "+maxLenStr);
            System.out.println(map);
        }catch(Exception e){
            e.printStackTrace();
        }

    }